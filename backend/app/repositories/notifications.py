from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import Broadcast, Notification, Run, User


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def add_many(self, user_ids: list[int], fields: dict, dedupe_key: str | None = None) -> list[int]:
        """Store one notification per user; users who already have ``dedupe_key`` are skipped. Returns who got it."""
        targets = list(dict.fromkeys(user_ids))
        if dedupe_key and targets:
            have = set(
                await self.s.scalars(
                    select(Notification.user_id).where(Notification.dedupe_key == dedupe_key, Notification.user_id.in_(targets))
                )
            )
            targets = [uid for uid in targets if uid not in have]
        self.s.add_all(Notification(user_id=uid, dedupe_key=dedupe_key, **fields) for uid in targets)
        await self.s.flush()
        return targets

    async def any_with_key(self, dedupe_key: str) -> bool:
        return await self.s.scalar(select(Notification.id).where(Notification.dedupe_key == dedupe_key).limit(1)) is not None

    async def page(
        self, user_id: int, *, unread: bool = False, priority: str | None = None, before: int | None = None, limit: int = 30
    ) -> list[tuple[Notification, str | None]]:
        """Newest first, with the sender's name for broadcasts."""
        query = (
            select(Notification, User.full_name)
            .outerjoin(Broadcast, Broadcast.id == Notification.broadcast_id)
            .outerjoin(User, User.id == Broadcast.sender_id)
            .where(Notification.user_id == user_id)
            .order_by(Notification.id.desc())
            .limit(limit)
        )
        if unread:
            query = query.where(Notification.read_at.is_(None))
        if priority:
            query = query.where(Notification.priority == priority)
        if before:
            query = query.where(Notification.id < before)
        return [(n, sender) for n, sender in (await self.s.execute(query)).all()]

    async def unread_counts(self, user_id: int) -> dict[str, int]:
        query = (
            select(Notification.priority, func.count(Notification.id))
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .group_by(Notification.priority)
        )
        return {priority: count for priority, count in (await self.s.execute(query)).all()}

    async def mark_read(self, user_id: int, ids: list[int] | None = None, priority: str | None = None) -> int:
        query = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=datetime.now(timezone.utc))
        )
        if ids is not None:
            query = query.where(Notification.id.in_(ids))
        if priority:
            query = query.where(Notification.priority == priority)
        return (await self.s.execute(query)).rowcount or 0

    # --- broadcasts ---------------------------------------------------------

    async def add_broadcast(self, broadcast: Broadcast) -> Broadcast:
        self.s.add(broadcast)
        await self.s.flush()
        return broadcast

    async def broadcasts(self, limit: int = 50) -> list[tuple[Broadcast, str | None, int]]:
        """Recent broadcasts with the sender's name and how many recipients have read them."""
        read = (
            select(Notification.broadcast_id, func.count(Notification.id).label("read"))
            .where(Notification.broadcast_id.is_not(None), Notification.read_at.is_not(None))
            .group_by(Notification.broadcast_id)
            .subquery()
        )
        query = (
            select(Broadcast, User.full_name, func.coalesce(read.c.read, 0))
            .outerjoin(User, User.id == Broadcast.sender_id)
            .outerjoin(read, read.c.broadcast_id == Broadcast.id)
            .order_by(Broadcast.id.desc())
            .limit(limit)
        )
        return [(b, sender, int(n)) for b, sender, n in (await self.s.execute(query)).all()]

    async def audience(
        self,
        *,
        roles: tuple[str, ...],
        positions: list[str],
        depots: list[str],
        teams: list[str],
        inactive_days: int | None,
        user_ids: list[int] | None = None,
    ) -> list[User]:
        """Employees of a slice: within a field any value matches, the fields combine with AND."""
        query = select(User).order_by(User.full_name)
        if user_ids is not None:
            query = query.where(User.id.in_(user_ids or [-1]))
        else:
            query = query.where(User.role.in_(roles))
        if positions:
            query = query.where(User.position.in_(positions))
        if depots:
            query = query.where(User.depot.in_(depots))
        if teams:
            query = query.where(User.team.in_(teams))
        if inactive_days:
            since = datetime.now(timezone.utc) - timedelta(days=inactive_days)
            recent = select(Run.user_id).where(Run.status == "finished", Run.finished_at >= since)
            query = query.where(User.id.not_in(recent))
        return list(await self.s.scalars(query))

    async def last_finish_by_user(self, roles: tuple[str, ...]) -> list[tuple[User, datetime | None]]:
        last = func.max(Run.finished_at)
        query = (
            select(User, last)
            .outerjoin(Run, (Run.user_id == User.id) & (Run.status == "finished"))
            .where(User.role.in_(roles))
            .group_by(User.id)
        )
        return [(u, at) for u, at in (await self.s.execute(query)).all()]

    async def units(self, roles: tuple[str, ...]) -> tuple[list[str], list[tuple[str, str]]]:
        """Depots and (depot, brigade) pairs that have employees — the slices to pick from."""
        query = select(User.depot, User.team).where(User.role.in_(roles), or_(User.depot != "", User.team != "")).distinct()
        pairs = sorted({(d, t) for d, t in (await self.s.execute(query)).all()})
        return sorted({d for d, _ in pairs if d}), [(d, t) for d, t in pairs if t]
