"""Notifications: delivery, the employee's inbox, broadcasts from leads, scheduled reminders."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.business import notifications as msg
from app.business.catalog import CATEGORIES, POSITIONS, position_rank
from app.business.errors import AppError, NotFound
from app.business.services.leaderboard import PLAYER_ROLES, week_start
from app.business.tournament import MSK, iso_week
from app.frameworks.metrics import NOTIFICATIONS
from app.repositories.models import Broadcast, Notification, User
from app.repositories.notifications import NotificationRepository
from app.repositories.points import PointsRepository
from app.repositories.tournaments import TournamentRepository
from app.repositories.users import UserRepository

PAGE = 30
PREVIEW_NAMES = 8

# Weekly reminders already sent by this process: saves re-checking every employee each tick.
# The dedupe keys in the database stay the source of truth across replicas and restarts.
_sent_weekly: set[str] = set()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def notify(session: AsyncSession, user_ids: list[int], m: msg.Message, broadcast_id: int | None = None) -> list[int]:
    """Store the message for the users (the caller commits). Returns who actually got it after dedupe."""
    if not user_ids:
        return []
    fields = {
        "kind": m.kind,
        "priority": m.priority,
        "title": m.title[:255],
        "body": m.body,
        "link": m.link,
        "icon": m.icon[:16],
        "broadcast_id": broadcast_id,
    }
    delivered = await NotificationRepository(session).add_many(user_ids, fields, m.dedupe)
    if delivered:
        NOTIFICATIONS.labels(kind=m.kind, priority=m.priority).inc(len(delivered))
    return delivered


def view(n: Notification, sender: str | None = None) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "priority": n.priority,
        "title": n.title,
        "body": n.body,
        "link": n.link or None,
        "icon": n.icon,
        "sender": sender,
        "created_at": n.created_at,
        "read": n.read_at is not None,
    }


def _counts(raw: dict[str, int]) -> dict:
    by = {p: raw.get(p, 0) for p in msg.PRIORITIES}
    return {"total": sum(by.values()), **by}


# --- the employee's inbox -------------------------------------------------------


async def inbox(
    session: AsyncSession, user: User, *, unread: bool, priority: str | None, before: int | None, limit: int = PAGE
) -> dict:
    if priority and priority not in msg.PRIORITIES:
        raise AppError("Неизвестная важность")
    repo = NotificationRepository(session)
    rows = await repo.page(user.id, unread=unread, priority=priority, before=before, limit=limit + 1)
    more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": [view(n, sender) for n, sender in rows],
        "next_before": rows[-1][0].id if more and rows else None,
        "unread": _counts(await repo.unread_counts(user.id)),
    }


async def summary(session: AsyncSession, user: User) -> dict:
    """What the bell needs: unread counters and the newest unread notification (for the toast)."""
    repo = NotificationRepository(session)
    latest = await repo.page(user.id, unread=True, limit=1)
    return {
        "unread": _counts(await repo.unread_counts(user.id)),
        "latest": view(*latest[0]) if latest else None,
    }


async def read(session: AsyncSession, user: User, notification_id: int) -> dict:
    repo = NotificationRepository(session)
    await repo.mark_read(user.id, ids=[notification_id])
    await session.commit()
    return {"unread": _counts(await repo.unread_counts(user.id))}


async def read_many(session: AsyncSession, user: User, ids: list[int]) -> dict:
    """What the employee has seen on screen; only their own notifications are touched."""
    repo = NotificationRepository(session)
    marked = await repo.mark_read(user.id, ids=list(dict.fromkeys(ids)))
    await session.commit()
    return {"marked": marked, "unread": _counts(await repo.unread_counts(user.id))}


async def read_all(session: AsyncSession, user: User, priority: str | None) -> dict:
    if priority and priority not in msg.PRIORITIES:
        raise AppError("Неизвестная важность")
    repo = NotificationRepository(session)
    marked = await repo.mark_read(user.id, priority=priority)
    await session.commit()
    return {"marked": marked, "unread": _counts(await repo.unread_counts(user.id))}


# --- broadcasts from leads ------------------------------------------------------


async def _resolve(session: AsyncSession, audience: dict) -> tuple[list[User], str]:
    mode = audience.get("mode", "all")
    repo = NotificationRepository(session)
    positions = [p for p in audience.get("positions") or [] if p in POSITIONS]
    depots = list(audience.get("depots") or [])
    teams = list(audience.get("teams") or [])
    inactive = audience.get("inactive_days")
    if mode == "users":
        ids = list(dict.fromkeys(audience.get("user_ids") or []))
        if not ids:
            raise AppError("Выберите хотя бы одного получателя")
        users = await repo.audience(roles=PLAYER_ROLES, positions=[], depots=[], teams=[], inactive_days=None, user_ids=ids)
        return users, msg.audience_label("users", names=[u.full_name for u in users])
    if mode == "segment":
        users = await repo.audience(roles=PLAYER_ROLES, positions=positions, depots=depots, teams=teams, inactive_days=inactive)
        label = msg.audience_label("segment", positions=positions, depots=depots, teams=teams, inactive_days=inactive)
        return users, label
    if mode != "all":
        raise AppError("Неизвестный тип аудитории")
    users = await repo.audience(roles=PLAYER_ROLES, positions=[], depots=[], teams=[], inactive_days=None)
    return users, msg.audience_label("all")


async def audience_options(session: AsyncSession) -> dict:
    depots, pairs = await NotificationRepository(session).units(PLAYER_ROLES)
    return {
        "positions": [{"code": code, "title": p["title"]} for code, p in sorted(POSITIONS.items(), key=lambda kv: kv[1]["rank"])],
        "depots": depots,
        "teams": [{"team": team, "depot": depot} for depot, team in pairs],
        "priorities": [{"code": p, "title": msg.PRIORITY_TITLES[p]} for p in msg.PRIORITIES],
    }


async def preview(session: AsyncSession, audience: dict) -> dict:
    users, label = await _resolve(session, audience)
    return {"count": len(users), "label": label, "sample": [u.full_name for u in users[:PREVIEW_NAMES]]}


def broadcast_view(b: Broadcast, sender: str | None, read_count: int) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "body": b.body,
        "priority": b.priority,
        "link": b.link or None,
        "audience_label": b.audience_label,
        "recipients": b.recipients,
        "read": read_count,
        "sender": sender,
        "created_at": b.created_at,
    }


async def send_broadcast(session: AsyncSession, sender: User, data: dict) -> dict:
    title = data["title"].strip()
    body = data.get("body", "").strip()
    priority = data.get("priority", "normal")
    link = (data.get("link") or "").strip()
    if not title:
        raise AppError("Нужен заголовок")
    if priority not in msg.PRIORITIES:
        raise AppError("Неизвестная важность")
    if not msg.is_internal_link(link):
        raise AppError("Ссылка должна вести на раздел приложения, например /scenarios")
    users, label = await _resolve(session, data.get("audience") or {"mode": "all"})
    if not users:
        raise AppError("Под выбранный срез не попал ни один сотрудник")
    repo = NotificationRepository(session)
    b = await repo.add_broadcast(
        Broadcast(
            sender_id=sender.id,
            title=title,
            body=body,
            priority=priority,
            link=link,
            audience=data.get("audience") or {"mode": "all"},
            audience_label=label[:255],
            recipients=len(users),
        )
    )
    await notify(session, [u.id for u in users], msg.broadcast(title, body, priority, link, sender.full_name), broadcast_id=b.id)
    await session.commit()
    return broadcast_view(b, sender.full_name, 0)


async def broadcasts(session: AsyncSession) -> list[dict]:
    return [broadcast_view(b, sender, n) for b, sender, n in await NotificationRepository(session).broadcasts()]


# --- events from other use cases -----------------------------------------------


async def position_changed(session: AsyncSession, user: User, old: str) -> None:
    await notify(session, [user.id], msg.position_changed(old, user.position))


async def unit_changed(session: AsyncSession, user: User) -> None:
    await notify(session, [user.id], msg.unit_changed(user.team, user.depot))


async def scenario_published(session: AsyncSession, scenario) -> None:
    """Tell employees who can play it: their own position's scenarios and the next position's (qualification)."""
    if scenario.kind != "training":
        return  # special events are a surprise
    rank = position_rank(scenario.position)
    employees = await UserRepository(session).list(roles=PLAYER_ROLES)
    own = [u.id for u in employees if position_rank(u.position) >= rank]
    qualification = [u.id for u in employees if position_rank(u.position) == rank - 1]
    category = CATEGORIES.get(scenario.category, {}).get("title", scenario.category)
    for ids, is_q in ((own, False), (qualification, True)):
        await notify(session, ids, msg.scenario_published(scenario.id, scenario.title, scenario.cover, category, is_q))


# --- scheduled: tournaments and weekly reminders --------------------------------


async def scheduler_tick(session: AsyncSession, now: datetime | None = None) -> None:
    now = now or _now()
    employees = None

    async def everyone() -> list[int]:
        nonlocal employees
        if employees is None:
            employees = [u.id for u in await UserRepository(session).list(roles=PLAYER_ROLES)]
        return employees

    tournaments = TournamentRepository(session)
    for t in await tournaments.starting_between(now, now + msg.TOURNAMENT_SOON):
        if t.starts_at <= now:
            continue
        await notify(session, await everyone(), msg.tournament_soon(t.id, t.title, t.starts_at.astimezone(MSK)))
    live = await tournaments.starting_between(now - msg.TOURNAMENT_SOON, now + msg.TOURNAMENT_SOON)
    for t in live:
        if t.starts_at <= now < t.ends_at:
            minutes = max(1, int((t.ends_at - now).total_seconds() // 60))
            await notify(session, await everyone(), msg.tournament_live(t.id, t.title, minutes))

    local = now.astimezone(MSK)
    week = iso_week(now)
    if (local.weekday(), local.hour) >= (msg.WEEKLY_RESET_WEEKDAY, msg.WEEKLY_RESET_HOUR):
        await _weekly_reset(session, now, week)
    if (local.weekday(), local.hour) >= (msg.IDLE_WEEKDAY, msg.IDLE_HOUR):
        await _idle(session, now, week)
    await session.commit()


async def _weekly_reset(session: AsyncSession, now: datetime, week: str) -> None:
    key = f"week:{week}:reset"
    if key in _sent_weekly or await NotificationRepository(session).any_with_key(key):
        _sent_weekly.add(key)
        return
    _sent_weekly.add(key)
    ranking = await PointsRepository(session).totals_since(week_start(now), PLAYER_ROLES)
    for place, (uid, points) in enumerate(ranking, start=1):
        if points > 0:
            await notify(session, [uid], msg.weekly_reset(week, place, points))


async def _idle(session: AsyncSession, now: datetime, week: str) -> None:
    key = f"week:{week}:idle"
    repo = NotificationRepository(session)
    if key in _sent_weekly or await repo.any_with_key(key):
        _sent_weekly.add(key)
        return
    _sent_weekly.add(key)
    for user, last in await repo.last_finish_by_user(PLAYER_ROLES):
        if last is None:
            await notify(session, [user.id], msg.idle(week, None))
        elif (now - last).days >= msg.IDLE_DAYS:
            await notify(session, [user.id], msg.idle(week, (now - last).days))
