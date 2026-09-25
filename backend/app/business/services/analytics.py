"""Dashboard for leads and HR: employees and overall training metrics."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.catalog import CATEGORIES, POSITIONS
from app.business.errors import NotFound
from app.business.services import profile as profile_service
from app.business.services.leaderboard import week_start
from app.business.services.presenters import user_brief
from app.business.tournament import MSK
from app.repositories.analytics import AnalyticsRepository
from app.repositories.cache import Cache
from app.repositories.users import UserRepository

EMPLOYEE_ROLES = ("employee",)
CACHE_TTL = 30


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def _rate(part: int, total: int) -> float:
    return round(part / total, 3) if total else 0.0


async def overview(session: AsyncSession, cache: Cache) -> dict:
    cached = await cache.get_json("analytics:overview")
    if cached:
        return cached
    now = datetime.now(timezone.utc)
    repo = AnalyticsRepository(session)
    users = await UserRepository(session).list(roles=EMPLOYEE_ROLES)
    runs = await repo.runs_since(now - timedelta(days=30), with_decisions=True)
    this_week = week_start(now)

    by_day: dict[str, dict] = {}
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).astimezone(MSK).date().isoformat()
        by_day[day] = {"date": day, "runs": 0, "success": 0, "fail": 0}
    categories: dict[str, list[dict]] = defaultdict(list)
    mistakes: Counter = Counter()
    mistake_meta: dict[tuple, dict] = {}
    decisions = timeouts = 0
    for r in runs:
        day = r["finished_at"].astimezone(MSK).date().isoformat()
        if day in by_day:
            by_day[day]["runs"] += 1
            by_day[day]["success"] += r["outcome"] == "success"
            by_day[day]["fail"] += r["outcome"] == "fail"
        categories[r["category"]].append(r)
        for d in r["decisions"] or []:
            if d["type"] not in ("choice", "input"):
                continue
            decisions += 1
            timeouts += bool(d.get("timed_out"))
            if d.get("quality") == "bad":
                key = (r["scenario_id"], d["node_id"])
                mistakes[key] += 1
                mistake_meta.setdefault(key, {"scenario": r["title"], "prompt": d["prompt"], "answers": Counter()})
                mistake_meta[key]["answers"][d["answer"]] += 1

    active_ids = {r["user_id"] for r in runs if r["finished_at"] >= now - timedelta(days=7)}
    week_runs = [r for r in runs if r["finished_at"] >= this_week]
    result = {
        "generated_at": now,
        "employees": len(users),
        "active_7d": len(active_ids),
        "runs_30d": len(runs),
        "runs_week": len(week_runs),
        "success_rate_30d": _rate(sum(r["outcome"] == "success" for r in runs), len(runs)),
        "avg_loyalty_30d": _avg([r["loyalty"] for r in runs]),
        "avg_safety_30d": _avg([r["safety"] for r in runs]),
        "timeout_rate_30d": _rate(timeouts, decisions),
        "emergencies_30d": sum(r["mode"] == "emergency" for r in runs),
        "runs_by_day": list(by_day.values()),
        "categories": [
            {
                "category": code,
                "title": meta["title"],
                "icon": meta["icon"],
                "runs": len(categories.get(code, [])),
                "success_rate": _rate(
                    sum(r["outcome"] == "success" for r in categories.get(code, [])), len(categories.get(code, []))
                ),
                "avg_loyalty": _avg([r["loyalty"] for r in categories.get(code, [])]),
                "avg_safety": _avg([r["safety"] for r in categories.get(code, [])]),
            }
            for code, meta in CATEGORIES.items()
        ],
        "positions": [
            {"position": code, "title": meta["title"], "count": sum(u.position == code for u in users)}
            for code, meta in POSITIONS.items()
        ],
        "top_mistakes": [
            {
                "scenario": mistake_meta[key]["scenario"],
                "prompt": mistake_meta[key]["prompt"],
                "typical_answer": mistake_meta[key]["answers"].most_common(1)[0][0],
                "count": count,
            }
            for key, count in mistakes.most_common(5)
        ],
    }
    await cache.set_json("analytics:overview", result, CACHE_TTL)
    return result


async def employees(session: AsyncSession, search: str | None = None) -> list[dict]:
    now = datetime.now(timezone.utc)
    repo = AnalyticsRepository(session)
    users = await UserRepository(session).list(search=search, roles=EMPLOYEE_ROLES)
    totals = await repo.totals_by_user()
    recent = await repo.runs_since(now - timedelta(days=60))
    week_points = await repo.points_since_by_user(week_start(now))
    last_30: dict[int, list[int]] = defaultdict(list)
    prev_30: dict[int, list[int]] = defaultdict(list)
    for r in recent:
        bucket = last_30 if r["finished_at"] >= now - timedelta(days=30) else prev_30
        bucket[r["user_id"]].append(r["safety"])
    rows = []
    for u in users:
        t = totals.get(u.id, {})
        cur, prev = _avg(last_30.get(u.id, [])), _avg(prev_30.get(u.id, []))
        rows.append(
            {
                **user_brief(u),
                "email": u.email,
                "last_active_at": u.last_active_at,
                "runs": t.get("runs", 0),
                "success_rate": _rate(t.get("successes", 0), t.get("runs", 0)),
                "avg_loyalty": t.get("avg_loyalty"),
                "avg_safety": t.get("avg_safety"),
                "safety_30d": cur,
                "safety_trend": round(cur - prev, 1) if cur is not None and prev is not None else None,
                "points_week": week_points.get(u.id, 0),
            }
        )
    return rows


async def employee_detail(session: AsyncSession, user_id: int) -> dict:
    user = await UserRepository(session).get(user_id)
    if user is None:
        raise NotFound("Сотрудник не найден")
    data = await profile_service.profile(session, user, full=True)
    data["history"] = await profile_service.history(session, user.id, limit=100)
    return data
