"""Employee profile, achievements and run history."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.achievements import CATALOGUE
from app.business.catalog import CATEGORIES, POSITIONS, position_rank, position_title
from app.business.errors import NotFound
from app.business.services.catalog import category_stats
from app.business.services.presenters import achievement_view, scenario_brief, user_full, user_public
from app.repositories.achievements import AchievementRepository
from app.repositories.models import User
from app.repositories.runs import RunRepository
from app.repositories.scenarios import ScenarioRepository
from app.repositories.users import UserRepository

PLAYER_ROLES = ("employee",)


async def _stats(session: AsyncSession, user: User) -> dict:
    finished = await RunRepository(session).finished_with_scenarios(user.id)
    training = [(r, s) for r, s in finished]
    total = len(training)
    successes = sum(1 for r, _ in training if r.outcome == "success")
    return {
        "runs_finished": total,
        "success_rate": round(successes / total, 3) if total else 0.0,
        "avg_loyalty": round(sum(r.loyalty for r, _ in training) / total) if total else None,
        "avg_safety": round(sum(r.safety for r, _ in training) / total) if total else None,
        "emergencies_handled": sum(1 for r, _ in training if r.mode == "emergency" and r.outcome != "fail"),
    }


async def _competencies(session: AsyncSession, user_id: int) -> list[dict]:
    stats = await category_stats(session, user_id)
    return [
        {
            "category": code,
            "title": meta["title"],
            "icon": meta["icon"],
            "mastery": stats[code].mastery if code in stats else 0.0,
            "runs": stats[code].runs if code in stats else 0,
        }
        for code, meta in CATEGORIES.items()
    ]


async def _qualification(session: AsyncSession, user: User) -> dict | None:
    """Progress on scenarios of the next position (повышение квалификации)."""
    next_position = next((c for c, p in POSITIONS.items() if p["rank"] == position_rank(user.position) + 1), None)
    if next_position is None:
        return None
    scenarios = [s for s in await ScenarioRepository(session).list(kind="training") if s.position == next_position]
    progress = await RunRepository(session).progress_by_scenario(user.id)
    passed = sum(1 for s in scenarios if progress.get(s.id, {}).get("best_outcome") == "success")
    return {
        "next_position": next_position,
        "next_position_title": position_title(next_position),
        "passed": passed,
        "total": len(scenarios),
        "ready": bool(scenarios) and passed == len(scenarios),
    }


async def profile(session: AsyncSession, user: User, *, full: bool) -> dict:
    users = UserRepository(session)
    achievements = await AchievementRepository(session).list_for(user.id)
    data = user_full(user) if full else user_public(user)
    return {
        **data,
        "rank": await users.rank_by_points(user.points, PLAYER_ROLES) if user.role in PLAYER_ROLES else None,
        "stats": await _stats(session, user),
        "competencies": await _competencies(session, user.id),
        "qualification": await _qualification(session, user),
        "achievements": [achievement_view(a) for a in achievements],
    }


async def public_profile(session: AsyncSession, user_id: int) -> dict:
    user = await UserRepository(session).get(user_id)
    if user is None:
        raise NotFound("Сотрудник не найден")
    return await profile(session, user, full=False)


async def set_name_display(session: AsyncSession, user: User, value: str) -> dict:
    """Short «Иван С.» or full «Иван Смирнов»: how colleagues see the employee."""
    user.name_display = value
    await session.commit()
    return await profile(session, user, full=True)


async def achievements_catalogue(session: AsyncSession, user: User) -> list[dict]:
    owned = {a.code: a for a in await AchievementRepository(session).list_for(user.id)}
    items = []
    for d in CATALOGUE:
        got = owned.get(d.code)
        items.append(
            {
                "code": d.code,
                "title": d.title,
                "description": d.description,
                "icon": d.icon,
                "rarity": d.rarity,
                "unlocked": got is not None,
                "awarded_at": got.awarded_at if got else None,
            }
        )
    static_codes = {d.code for d in CATALOGUE}
    for code, got in owned.items():
        if code not in static_codes:  # tournament trophies are generated per week
            items.append({**achievement_view(got), "unlocked": True})
    return items


async def history(session: AsyncSession, user_id: int, limit: int = 50) -> list[dict]:
    finished = await RunRepository(session).finished_with_scenarios(user_id, limit=limit)
    return [
        {
            "id": r.id,
            "scenario": scenario_brief(s),
            "mode": r.mode,
            "outcome": r.outcome,
            "loyalty": r.loyalty,
            "safety": r.safety,
            "points_awarded": r.points_awarded,
            "finished_at": r.finished_at,
        }
        for r, s in finished
    ]
