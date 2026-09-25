"""Scenario catalogue for a player and adaptive recommendation."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.adaptation import Candidate, CategoryStat, recommend
from app.business.catalog import CATEGORIES, POSITIONS, run_mode_for
from app.business.errors import NotFound
from app.business.services.presenters import scenario_brief
from app.repositories.models import User
from app.repositories.runs import RunRepository
from app.repositories.scenarios import ScenarioRepository


async def list_scenarios(session: AsyncSession, user: User) -> dict:
    scenarios = await ScenarioRepository(session).list(kind="training")
    progress = await RunRepository(session).progress_by_scenario(user.id)
    items = []
    for s in scenarios:
        mode = run_mode_for(user.position, s.position, s.kind)
        p = progress.get(s.id, {})
        items.append(
            {
                **scenario_brief(s),
                "mode": mode or "locked",
                "locked": mode is None,
                "finishes": p.get("finishes", 0),
                "best_outcome": p.get("best_outcome"),
                "best_points": p.get("best_points", 0),
                "active_run_id": p.get("active_run_id"),
            }
        )
    return {
        "items": items,
        "positions": [{"code": k, **v} for k, v in POSITIONS.items()],
        "categories": [{"code": k, **v} for k, v in CATEGORIES.items()],
    }


async def get_scenario(session: AsyncSession, user: User, scenario_id: int) -> dict:
    s = await ScenarioRepository(session).get(scenario_id)
    if s is None or not s.is_published:
        raise NotFound("Сценарий не найден")
    mode = run_mode_for(user.position, s.position, s.kind)
    characters = list((s.graph.get("characters") or {}).values())
    return {**scenario_brief(s), "mode": mode or "locked", "locked": mode is None, "characters": characters}


async def category_stats(session: AsyncSession, user_id: int) -> dict[str, CategoryStat]:
    finished = await RunRepository(session).finished_with_scenarios(user_id)
    raw: dict[str, dict] = {}
    for run, scenario in finished:
        item = raw.setdefault(scenario.category, {"runs": 0, "successes": 0, "best": 0, "rated": 0})
        item["runs"] += 1
        item["successes"] += run.outcome == "success"
        for d in run.decisions or []:
            if d["type"] in ("choice", "input"):
                item["rated"] += 1
                item["best"] += d["quality"] == "best"
    return {
        c: CategoryStat(c, v["runs"], v["successes"], (v["best"] / v["rated"]) if v["rated"] else 0.0)
        for c, v in raw.items()
    }


async def recommended(session: AsyncSession, user: User) -> dict | None:
    scenarios = await ScenarioRepository(session).list(kind="training")
    progress = await RunRepository(session).progress_by_scenario(user.id)
    by_id = {s.id: s for s in scenarios}
    candidates = [
        Candidate(
            scenario_id=s.id,
            category=s.category,
            difficulty=s.difficulty,
            finishes=progress.get(s.id, {}).get("finishes", 0),
            best_outcome=progress.get(s.id, {}).get("best_outcome"),
        )
        for s in scenarios
        if run_mode_for(user.position, s.position, s.kind) == "training"
    ]
    picked = recommend(await category_stats(session, user.id), candidates)
    if picked is None:
        return None
    candidate, reason = picked
    return {"scenario": scenario_brief(by_id[candidate.scenario_id]), "reason": reason}
