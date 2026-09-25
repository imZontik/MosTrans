"""Weekly tournament rules: schedule and question selection."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

MSK = ZoneInfo("Europe/Moscow")


def iso_week(moment: datetime) -> str:
    year, week, _ = moment.astimezone(MSK).isocalendar()
    return f"{year}-W{week:02d}"


def weekly_window(moment: datetime, weekday: int, hour: int, duration_min: int) -> tuple[datetime, datetime]:
    """Tournament window of the ISO week containing ``moment`` (Moscow time)."""
    local = moment.astimezone(MSK)
    monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    start = (monday + timedelta(days=weekday)).replace(hour=hour)
    return start.astimezone(timezone.utc), (start + timedelta(minutes=duration_min)).astimezone(timezone.utc)


def status_of(starts_at: datetime, ends_at: datetime, now: datetime) -> str:
    if now < starts_at:
        return "scheduled"
    if now < ends_at:
        return "live"
    return "finished"


def pick_questions(pool: list[dict], count: int, seed: str) -> list[dict]:
    """Deterministic per tournament, balanced across categories."""
    rng = random.Random(seed)
    by_category: dict[str, list[dict]] = {}
    for q in pool:
        by_category.setdefault(q.get("category", "other"), []).append(q)
    for items in by_category.values():
        rng.shuffle(items)
    picked: list[dict] = []
    while len(picked) < min(count, len(pool)):
        for items in by_category.values():
            if items and len(picked) < count:
                picked.append(items.pop())
    rng.shuffle(picked)
    return picked


def public_question(question: dict, index: int, total: int) -> dict:
    return {
        "index": index,
        "total": total,
        "text": question["text"],
        "options": question["options"],
        "timer": question.get("timer", 15),
        "category": question.get("category"),
    }
