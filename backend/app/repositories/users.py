from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def get(self, user_id: int) -> User | None:
        return await self.s.get(User, user_id)

    async def get_many(self, ids: list[int]) -> dict[int, User]:
        if not ids:
            return {}
        rows = await self.s.scalars(select(User).where(User.id.in_(ids)))
        return {u.id: u for u in rows}

    async def get_by_email(self, email: str) -> User | None:
        return await self.s.scalar(select(User).where(func.lower(User.email) == email.lower()))

    async def add(self, user: User) -> User:
        self.s.add(user)
        await self.s.flush()
        return user

    async def list(self, *, search: str | None = None, roles: tuple[str, ...] | None = None) -> list[User]:
        query = select(User).order_by(User.points.desc())
        if roles:
            query = query.where(User.role.in_(roles))
        if search:
            like = f"%{search.lower()}%"
            query = query.where(or_(func.lower(User.full_name).like(like), func.lower(User.email).like(like)))
        return list(await self.s.scalars(query))

    async def count(self, roles: tuple[str, ...]) -> int:
        return await self.s.scalar(select(func.count(User.id)).where(User.role.in_(roles))) or 0

    async def touch(self, user_id: int) -> None:
        await self.s.execute(update(User).where(User.id == user_id).values(last_active_at=datetime.now(timezone.utc)))

    async def rank_by_points(self, points: int, roles: tuple[str, ...]) -> int:
        higher = await self.s.scalar(select(func.count(User.id)).where(User.points > points, User.role.in_(roles)))
        return (higher or 0) + 1
