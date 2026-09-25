"""Training report for HR: the same metrics as the dashboard, per period and per employee, for export."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.catalog import CATEGORIES, position_title
from app.business.economy import level_for
from app.repositories.analytics import AnalyticsRepository
from app.repositories.users import UserRepository

MIN_RUNS_FOR_WEAK = 2  # a single failed run is not yet a gap in a competency


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def _rate(part: int, total: int) -> float | None:
    return round(part / total, 3) if total else None


def _decisions(run: dict) -> list[dict]:
    return [d for d in run["decisions"] or [] if d["type"] in ("choice", "input")]


def _weakest_category(runs: list[dict]) -> str | None:
    by_category: dict[str, list[dict]] = defaultdict(list)
    for r in runs:
        by_category[r["category"]].append(r)
    rated = [
        (sum(r["outcome"] == "success" for r in items) / len(items), code)
        for code, items in by_category.items()
        if len(items) >= MIN_RUNS_FOR_WEAK
    ]
    if not rated:
        return None
    rate, code = min(rated)
    return CATEGORIES.get(code, {"title": code})["title"] if rate < 1 else None


async def training_report(session: AsyncSession, days: int) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    repo = AnalyticsRepository(session)
    users = await UserRepository(session).list(roles=("employee",))
    # Two periods back to compare safety with the previous one of the same length
    runs = await repo.runs_since(since - timedelta(days=days), with_decisions=True)
    points = await repo.points_since_by_user(since)

    current = [r for r in runs if r["finished_at"] >= since]
    previous = [r for r in runs if r["finished_at"] < since]
    by_user: dict[int, list[dict]] = defaultdict(list)
    prev_safety: dict[int, list[int]] = defaultdict(list)
    for r in current:
        by_user[r["user_id"]].append(r)
    for r in previous:
        prev_safety[r["user_id"]].append(r["safety"])

    employees = []
    for u in sorted(users, key=lambda u: u.full_name):
        mine = by_user.get(u.id, [])
        decisions = [d for r in mine for d in _decisions(r)]
        safety = _avg([r["safety"] for r in mine])
        before = _avg(prev_safety.get(u.id, []))
        employees.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "position": position_title(u.position),
                "team": u.team,
                "level": level_for(u.points).level,
                "points_total": u.points,
                "points_period": points.get(u.id, 0),
                "runs": len(mine),
                "success_rate": _rate(sum(r["outcome"] == "success" for r in mine), len(mine)),
                "avg_loyalty": _avg([r["loyalty"] for r in mine]),
                "avg_safety": safety,
                "safety_trend": round(safety - before, 1) if safety is not None and before is not None else None,
                "timeout_rate": _rate(sum(bool(d.get("timed_out")) for d in decisions), len(decisions)),
                "weak_category": _weakest_category(mine),
                "last_active_at": u.last_active_at,
            }
        )

    by_category: dict[str, list[dict]] = defaultdict(list)
    for r in current:
        by_category[r["category"]].append(r)
    categories = []
    for code, meta in CATEGORIES.items():
        items = by_category.get(code, [])
        decisions = [d for r in items for d in _decisions(r)]
        categories.append(
            {
                "title": meta["title"],
                "runs": len(items),
                "employees": len({r["user_id"] for r in items}),
                "success_rate": _rate(sum(r["outcome"] == "success" for r in items), len(items)),
                "avg_loyalty": _avg([r["loyalty"] for r in items]),
                "avg_safety": _avg([r["safety"] for r in items]),
                "timeout_rate": _rate(sum(bool(d.get("timed_out")) for d in decisions), len(decisions)),
            }
        )

    mistakes: Counter = Counter()
    meta: dict[tuple, dict] = {}
    for r in current:
        for d in _decisions(r):
            if d.get("quality") != "bad":
                continue
            key = (r["scenario_id"], d["node_id"])
            mistakes[key] += 1
            meta.setdefault(key, {"scenario": r["title"], "prompt": d["prompt"], "answers": Counter(), "users": set()})
            meta[key]["answers"][d["answer"]] += 1
            meta[key]["users"].add(r["user_id"])

    all_decisions = [d for r in current for d in _decisions(r)]
    return {
        "generated_at": now,
        "days": days,
        "since": since,
        "summary": {
            "employees": len(users),
            "active": len(by_user),
            "runs": len(current),
            "success_rate": _rate(sum(r["outcome"] == "success" for r in current), len(current)),
            "avg_loyalty": _avg([r["loyalty"] for r in current]),
            "avg_safety": _avg([r["safety"] for r in current]),
            "timeout_rate": _rate(sum(bool(d.get("timed_out")) for d in all_decisions), len(all_decisions)),
            "emergencies": sum(r["mode"] == "emergency" for r in current),
            "points": sum(points.get(u.id, 0) for u in users),
        },
        "employees": employees,
        "categories": categories,
        "mistakes": [
            {
                "scenario": meta[key]["scenario"],
                "prompt": meta[key]["prompt"],
                "count": count,
                "employees": len(meta[key]["users"]),
                "typical_answer": meta[key]["answers"].most_common(1)[0][0],
            }
            for key, count in mistakes.most_common(20)
        ],
    }
