from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import PointsLedger, User


class PointsRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def award(self, user_id: int, amount: int, reason: str, ref: str, at: datetime | None = None) -> None:
        if amount == 0:
            return
        entry = PointsLedger(user_id=user_id, amount=amount, reason=reason, ref=ref)
        if at is not None:
            entry.created_at = at
        self.s.add(entry)
        await self.s.execute(update(User).where(User.id == user_id).values(points=User.points + amount))

    async def totals_since(self, since: datetime, roles: tuple[str, ...]) -> list[tuple[int, int]]:
        """[(user_id, points)] earned since the moment, best first."""
        total = func.sum(PointsLedger.amount).label("total")
        query = (
            select(PointsLedger.user_id, total)
            .join(User, User.id == PointsLedger.user_id)
            .where(PointsLedger.created_at >= since, User.role.in_(roles))
            .group_by(PointsLedger.user_id)
            .order_by(total.desc(), PointsLedger.user_id)
        )
        return [(uid, int(pts)) for uid, pts in (await self.s.execute(query)).all()]
