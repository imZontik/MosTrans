"""Emergency special events (специвент).

In the middle of a working day the employee suddenly receives an emergency with
a pre-recorded voice message and has to react. Events come either from a lead
(dispatch) or at random moments while the employee is in the app.
"""

from __future__ import annotations

import random
import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.economy import level_for
from app.business.errors import NotFound
from app.business.services.presenters import scenario_brief
from app.frameworks.config import get_settings
from app.frameworks.metrics import EMERGENCIES
from app.repositories.cache import EmergencyQueue
from app.repositories.models import Scenario, User
from app.repositories.runs import RunRepository
from app.repositories.scenarios import ScenarioRepository
from app.repositories.users import UserRepository

HARD_LEVEL = 3  # English voice messages show up from this level


def _event(scenario: Scenario, source: str, message: str | None) -> dict:
    graph = scenario.graph
    return {
        "scenario": scenario_brief(scenario),
        "source": source,
        "message": message,
        "alert": graph.get("alert") or scenario.description,
        "audio": graph.get("alert_audio"),
        "hard": "english" in (graph.get("tags") or []),
    }


async def _pick_random(session: AsyncSession, user: User) -> Scenario | None:
    scenarios = await ScenarioRepository(session).list(kind="emergency")
    if level_for(user.points).level < HARD_LEVEL:
        scenarios = [s for s in scenarios if "english" not in (s.graph.get("tags") or [])]
    if not scenarios:
        return None
    progress = await RunRepository(session).progress_by_scenario(user.id)
    unplayed = [s for s in scenarios if not progress.get(s.id, {}).get("finishes")]
    return random.choice(unplayed or scenarios)


async def pending(session: AsyncSession, queue: EmergencyQueue, user: User) -> dict:
    if await RunRepository(session).has_active_emergency(user.id):
        return {"event": None}

    dispatched = await queue.pop(user.id)
    if dispatched:
        scenario = await ScenarioRepository(session).get(dispatched["scenario_id"])
        if scenario is not None:
            EMERGENCIES.labels(source="lead").inc()
            return {"event": _event(scenario, "lead", dispatched.get("message"))}

    if user.role != "employee":
        return {"event": None}
    interval = get_settings().emergency_min_interval_sec
    now = time.time()
    due = await queue.next_random_at(user.id)
    if due is None:
        await queue.schedule_random(user.id, now + random.uniform(interval, 2 * interval))
        return {"event": None}
    if now < due:
        return {"event": None}
    await queue.schedule_random(user.id, now + random.uniform(interval, 2 * interval))
    scenario = await _pick_random(session, user)
    if scenario is None:
        return {"event": None}
    EMERGENCIES.labels(source="random").inc()
    return {"event": _event(scenario, "random", None)}


async def dispatch(
    session: AsyncSession,
    queue: EmergencyQueue,
    *,
    scenario_id: int,
    user_ids: list[int] | None,
    message: str | None,
) -> dict:
    scenario = await ScenarioRepository(session).get(scenario_id)
    if scenario is None or scenario.kind != "emergency":
        raise NotFound("Экстренный сценарий не найден")
    users = UserRepository(session)
    if user_ids:
        targets = list((await users.get_many(user_ids)).values())
    else:
        targets = await users.list(roles=("employee",))
    for target in targets:
        await queue.push(target.id, {"scenario_id": scenario.id, "message": message})
    return {"dispatched": len(targets), "scenario": scenario_brief(scenario)}


async def list_emergencies(session: AsyncSession) -> list[dict]:
    return [scenario_brief(s) for s in await ScenarioRepository(session).list(kind="emergency")]
