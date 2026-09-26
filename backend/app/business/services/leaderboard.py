"""Leaderboards among conductors: this week and all time, in the company, a depot or a brigade."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.services.presenters import user_brief
from app.business.tournament import MSK, iso_week
from app.repositories.cache import Cache
from app.repositories.models import User
from app.repositories.points import PointsRepository
from app.repositories.users import UserRepository

PLAYER_ROLES = ("employee",)
CACHE_TTL = 15


def week_start(now: datetime) -> datetime:
    local = now.astimezone(MSK)
    monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return monday.astimezone(timezone.utc)


async def _ranking(session: AsyncSession, cache: Cache, period: str) -> list[tuple[int, int]]:
    now = datetime.now(timezone.utc)
    key = f"leaderboard:{period}:{iso_week(now) if period == 'week' else 'all'}"
    cached = await cache.get_json(key)
    if cached is not None:
        return [tuple(x) for x in cached]
    if period == "week":
        ranking = await PointsRepository(session).totals_since(week_start(now), PLAYER_ROLES)
    else:
        ranking = [(u.id, u.points) for u in await UserRepository(session).list(roles=PLAYER_ROLES)]
    await cache.set_json(key, ranking, CACHE_TTL)
    return ranking


def unit_of(me: User, scope: str) -> str:
    """The user's own brigade or depot; empty for the whole company or when not assigned."""
    if scope == "team":
        return me.team
    if scope == "depot":
        return me.depot
    return ""


def within(ranking: list[tuple[int, int]], members: set[int]) -> list[tuple[int, int]]:
    """Company ranking narrowed to a brigade/depot; order (and so the places) is kept."""
    return [(uid, value) for uid, value in ranking if uid in members]


async def leaderboard(
    session: AsyncSession,
    cache: Cache,
    me: User,
    period: str,
    limit: int,
    scope: str = "company",
    unit: str | None = None,
) -> dict:
    """Ranking of conductors in the company, a depot or a brigade (FR-6).

    By default an employee sees their own depot/brigade; ``unit`` picks another one
    (leads use it to look at any brigade).
    """
    users_repo = UserRepository(session)
    ranking = await _ranking(session, cache, period)
    name = (unit or unit_of(me, scope) or None) if scope != "company" else None
    in_unit = True
    if scope != "company":
        members = await users_repo.ids_in_unit(scope, name, PLAYER_ROLES) if name else set()
        ranking = within(ranking, members)
        in_unit = me.id in members

    top = ranking[:limit]
    users = await users_repo.get_many([uid for uid, _ in top] + [me.id])
    entries = [
        {"rank": i + 1, "value": value, "is_me": uid == me.id, **user_brief(users[uid])}
        for i, (uid, value) in enumerate(top)
        if uid in users
    ]
    my_index = next((i for i, (uid, _) in enumerate(ranking) if uid == me.id), None)
    my_entry = None
    if my_index is not None:
        my_entry = {"rank": my_index + 1, "value": ranking[my_index][1], "is_me": True, **user_brief(me)}
    elif me.role in PLAYER_ROLES and in_unit:
        my_entry = {"rank": None, "value": 0, "is_me": True, **user_brief(me)}
    return {
        "period": period,
        "scope": scope,
        "unit": name,
        "entries": entries,
        "me": my_entry,
        "participants": len(ranking),
    }


async def units(session: AsyncSession) -> dict:
    """Depots and brigades to pick a leaderboard from."""
    rows = await UserRepository(session).units(PLAYER_ROLES)
    depots: dict[str, int] = {}
    for depot, _, count in rows:
        if depot:
            depots[depot] = depots.get(depot, 0) + count
    return {
        "depots": [{"name": name, "members": count} for name, count in depots.items()],
        "teams": [{"name": team, "depot": depot, "members": count} for depot, team, count in rows],
    }


async def invalidate(cache: Cache) -> None:
    await cache.delete_prefix("leaderboard:")
