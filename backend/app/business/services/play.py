"""Playing scenarios: start a run, answer a step, finish with rewards."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.frameworks.config import get_settings
from app.business.errors import AppError, Forbidden, NotFound
from app.frameworks.metrics import ACHIEVEMENTS, DECISION_TIME, DECISIONS, POINTS_AWARDED, RUNS_FINISHED, RUNS_STARTED
from app.repositories.models import Run, Scenario, User
from app.business import achievements as ach
from app.business.catalog import STAFF_ROLES, position_title, run_mode_for
from app.business.economy import level_for, run_reward
from app.business.engine import (
    RunState,
    ScenarioError,
    apply_answer,
    end_texts,
    ending_key,
    endings,
    get_node,
    initial_state,
    public_node,
)
from app.repositories.ml_gateway import MLGateway
from app.repositories.achievements import AchievementRepository
from app.repositories.points import PointsRepository
from app.repositories.runs import RunRepository
from app.repositories.scenarios import ScenarioRepository
from app.business.services.presenters import scenario_brief

HISTORY_TYPES = ("scene", "choice", "input")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state(run: Run) -> RunState:
    return RunState(
        node_id=run.current_node,
        loyalty=run.loyalty,
        safety=run.safety,
        score=run.score,
        decisions=list(run.decisions or []),
        finished=run.status == "finished",
        outcome=run.outcome,
    )


def _speaker(graph: dict, key: str) -> dict:
    character = (graph.get("characters") or {}).get(key) or {}
    return {"speaker": key, "speaker_name": character.get("name"), "avatar": character.get("avatar")}


def run_view(run: Run, scenario: Scenario) -> dict:
    graph = scenario.graph
    node = public_node(graph, run.current_node)
    if node.get("choices"):
        # Stable per run, so the best answer is not always first
        random.Random(f"{run.id}:{run.current_node}").shuffle(node["choices"])
    if node.get("timer") and run.status == "active" and run.node_started_at:
        node["deadline"] = run.node_started_at + timedelta(seconds=node["timer"])
    if node["type"] == "end":
        node.update(end_texts(get_node(graph, run.current_node), run.outcome))
        node["outcome"] = run.outcome
    history = [
        {
            **_speaker(graph, d.get("speaker", "narrator")),
            "node_id": d["node_id"],
            "type": d["type"],
            "text": d["prompt"],
            "answer": d["answer"],
            "quality": d["quality"],
            "points": d["points"],
            "effects": d["effects"],
            "feedback": d["feedback"],
            "timed_out": d["timed_out"],
            "fast": d["fast"],
            "grade": d.get("grade"),
        }
        for d in run.decisions or []
        if d["type"] in HISTORY_TYPES
    ]
    return {
        "id": run.id,
        "status": run.status,
        "mode": run.mode,
        "outcome": run.outcome,
        "loyalty": run.loyalty,
        "safety": run.safety,
        "score": run.score,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "server_now": _now(),
        "scenario": scenario_brief(scenario),
        "node": node,
        "history": history,
        "summary": run.summary,
    }


async def _load(session: AsyncSession, run_id: int, user: User, lock: bool = False) -> tuple[Run, Scenario]:
    runs = RunRepository(session)
    run = await (runs.get_for_update(run_id) if lock else runs.get(run_id))
    if run is None or (run.user_id != user.id and user.role not in STAFF_ROLES):
        raise NotFound("Прохождение не найдено")
    scenario = await ScenarioRepository(session).get(run.scenario_id)
    return run, scenario


async def start_run(session: AsyncSession, user: User, scenario_id: int, restart: bool = False) -> dict:
    scenario = await ScenarioRepository(session).get(scenario_id)
    if scenario is None or (not scenario.is_published and user.role not in STAFF_ROLES):
        raise NotFound("Сценарий не найден")
    mode = run_mode_for(user.position, scenario.position, scenario.kind)
    if mode is None and user.role not in STAFF_ROLES:
        raise Forbidden(
            f"Сценарий для должности «{position_title(scenario.position)}» откроется, "
            "когда вы подниметесь на ступень ниже неё."
        )
    mode = mode or "qualification"
    runs = RunRepository(session)
    active = await runs.active_for(user.id, scenario.id)
    if active is not None:
        if not restart:
            return run_view(active, scenario)
        active.status = "abandoned"
        active.finished_at = _now()
    state = initial_state(scenario.graph)
    run = await runs.add(
        Run(
            user_id=user.id,
            scenario_id=scenario.id,
            mode=mode,
            status="active",
            current_node=state.node_id,
            node_started_at=_now(),
            loyalty=state.loyalty,
            safety=state.safety,
            score=0,
            decisions=[],
        )
    )
    await session.commit()
    RUNS_STARTED.labels(mode=mode, category=scenario.category).inc()
    return run_view(run, scenario)


async def get_run(session: AsyncSession, user: User, run_id: int) -> dict:
    run, scenario = await _load(session, run_id, user)
    return run_view(run, scenario)


async def abandon_run(session: AsyncSession, user: User, run_id: int) -> dict:
    run, scenario = await _load(session, run_id, user, lock=True)
    if run.status == "active":
        run.status = "abandoned"
        run.finished_at = _now()
        await session.commit()
    return run_view(run, scenario)


async def answer(
    session: AsyncSession,
    ml: MLGateway,
    user: User,
    run_id: int,
    *,
    node_id: str,
    action: str,
    choice_id: str | None,
    text: str | None,
) -> dict:
    run, scenario = await _load(session, run_id, user, lock=True)
    if run.user_id != user.id:
        raise Forbidden("Нельзя отвечать за другого сотрудника")
    if run.status != "active":
        raise AppError("Прохождение уже завершено")
    graph = scenario.graph
    node = get_node(graph, run.current_node)
    if node_id != run.current_node:
        raise AppError("Этот шаг уже пройден — обновите страницу", 409)

    now = _now()
    elapsed = (now - run.node_started_at).total_seconds() if run.node_started_at else None
    timer = node.get("timer")
    grace = get_settings().answer_grace_sec
    if timer and elapsed is not None:
        if action in ("choose", "answer") and elapsed > timer + grace:
            action = "timeout"  # the server clock is authoritative
        elif action == "timeout" and elapsed < timer - grace:
            raise AppError("Таймер ещё не истёк")

    grade = None
    if node["type"] == "input" and action == "answer":
        if not text or not text.strip():
            raise AppError("Введите ответ")
        grade = await ml.grade(
            situation=node.get("text", ""),
            rubric=node.get("rubric", ""),
            ideal=node.get("ideal", ""),
            keywords=node.get("keywords") or [],
            answer=text.strip()[:2000],
            lang=node.get("lang") or graph.get("lang") or "ru",
        )

    state = _state(run)
    try:
        result = apply_answer(
            graph, state, node_id=node_id, action=action, choice_id=choice_id, text=text, grade=grade, elapsed=elapsed
        )
    except ScenarioError as exc:
        raise AppError(str(exc)) from exc

    if node["type"] != "scene":
        DECISIONS.labels(node_type=node["type"], quality=result["quality"], timed_out=str(result["timed_out"])).inc()
        if timer and elapsed is not None and not result["timed_out"]:
            DECISION_TIME.observe(elapsed)

    run.current_node = state.node_id
    run.loyalty = state.loyalty
    run.safety = state.safety
    run.score = state.score
    run.decisions = state.decisions
    run.node_started_at = now
    if state.finished:
        await _finish(session, user, run, scenario, state)
    await session.commit()
    return {"result": result, "run": run_view(run, scenario)}


async def _finish(session: AsyncSession, user: User, run: Run, scenario: Scenario, state: RunState) -> None:
    runs = RunRepository(session)
    run.status = "finished"
    run.outcome = state.outcome
    run.finished_at = _now()

    previous = await runs.count_finishes(user.id, scenario.id, exclude_run=run.id)
    reward = run_reward(
        decision_points=state.score,
        loyalty=state.loyalty,
        safety=state.safety,
        outcome=state.outcome or "fail",
        difficulty=scenario.difficulty,
        mode=run.mode,
        previous_finishes=previous,
    )
    points_before = user.points  # award() also syncs the in-memory user, so read it first
    level_before = level_for(points_before)
    run.points_awarded = reward["total"]
    await PointsRepository(session).award(user.id, reward["total"], "run", f"run:{run.id}")
    POINTS_AWARDED.labels(reason="run").inc(reward["total"])
    points_after = points_before + reward["total"]
    level_after = level_for(points_after)
    await session.flush()

    unlocked = await _unlock_achievements(session, user, run, scenario, level_after.level)
    RUNS_FINISHED.labels(mode=run.mode, category=scenario.category, outcome=run.outcome).inc()

    end = end_texts(get_node(scenario.graph, state.node_id), run.outcome)
    all_endings = endings(scenario.graph)
    ending = ending_key(scenario.graph, state.node_id, run.outcome)
    seen: set[str] = set()
    for node_id, outcome in await runs.finished_endings(user.id, scenario.id, exclude_run=run.id):
        try:
            seen.add(ending_key(scenario.graph, node_id or "", outcome))
        except ScenarioError:  # the scenario was edited since, that node is gone
            continue
    rated = [d for d in state.decisions if d["type"] in ("choice", "input")]
    run.summary = {
        "outcome": run.outcome,
        "title": end["title"],
        "text": end["text"],
        "reward": reward,
        "achievements": [
            {"code": a.code, "title": a.title, "description": a.description, "icon": a.icon, "rarity": a.rarity}
            for a in unlocked
        ],
        "level_before": level_before.level,
        "level_after": level_after.level,
        "level_title": level_after.title,
        "level_up": level_after.level > level_before.level,
        "points_total": points_after,
        "stats": {
            "decisions": len(rated),
            "best": sum(1 for d in rated if d["quality"] == "best"),
            "fast": sum(1 for d in rated if d["fast"]),
            "timeouts": sum(1 for d in rated if d["timed_out"]),
        },
        "debrief": _debrief(scenario.graph, rated),
        # Which of the scenario's endings this run reached and how many the player has seen so far
        "ending": {
            "key": ending,
            "new": ending in all_endings and ending not in seen,
            "found": len((seen | {ending}) & set(all_endings)),
            "total": len(all_endings),
        },
    }


def _debrief(graph: dict, rated: list[dict]) -> list[dict]:
    """Decisions that were not optimal, with the recommended action."""
    items = []
    for d in rated:
        if d["quality"] == "best":
            continue
        node = graph["nodes"].get(d["node_id"], {})
        recommended = None
        if node.get("type") == "choice":
            best = next((c for c in node.get("choices", []) if c.get("quality") == "best"), None)
            recommended = best["text"] if best else None
        elif node.get("type") == "input":
            recommended = node.get("ideal")
        items.append(
            {
                "node_id": d["node_id"],
                "prompt": d["prompt"],
                "answer": d["answer"],
                "quality": d["quality"],
                "feedback": d["feedback"],
                "recommended": recommended,
                "explanation": node.get("explanation"),
            }
        )
    return items


async def player_stats(session: AsyncSession, user_id: int, level: int) -> ach.PlayerStats:
    finished = await RunRepository(session).finished_with_scenarios(user_id)
    success_categories = {s.category for r, s in finished if r.outcome == "success"}
    redirect_correct = fast = 0
    for r, _ in finished:
        for d in r.decisions or []:
            if "redirect" in (d.get("tags") or []) and d.get("quality") == "best":
                redirect_correct += 1
            if d.get("fast"):
                fast += 1
    return ach.PlayerStats(
        finished_runs=len(finished),
        success_categories=success_categories,
        redirect_correct=redirect_correct,
        fast_decisions=fast,
        level=level,
    )


async def _unlock_achievements(
    session: AsyncSession, user: User, run: Run, scenario: Scenario, level: int
) -> list[ach.AchievementDef]:
    repo = AchievementRepository(session)
    owned = await repo.codes_for(user.id)
    stats = await player_stats(session, user.id, level)
    finished = ach.FinishedRun(
        outcome=run.outcome,
        category=scenario.category,
        mode=run.mode,
        kind=scenario.kind,
        loyalty=run.loyalty,
        safety=run.safety,
        decisions=run.decisions,
        tags=list(scenario.graph.get("tags") or []),
    )
    unlocked = ach.evaluate(finished, stats, owned)
    for definition in unlocked:
        await repo.grant(user.id, definition)
        ACHIEVEMENTS.labels(code=definition.code).inc()
    return unlocked
