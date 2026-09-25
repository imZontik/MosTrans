from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import UserAchievement
from app.business.achievements import AchievementDef


class AchievementRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def list_for(self, user_id: int) -> list[UserAchievement]:
        return list(
            await self.s.scalars(
                select(UserAchievement).where(UserAchievement.user_id == user_id).order_by(UserAchievement.awarded_at)
            )
        )

    async def codes_for(self, user_id: int) -> set[str]:
        return set(await self.s.scalars(select(UserAchievement.code).where(UserAchievement.user_id == user_id)))

    async def grant(self, user_id: int, definition: AchievementDef) -> UserAchievement:
        item = UserAchievement(
            user_id=user_id,
            code=definition.code,
            title=definition.title,
            description=definition.description,
            icon=definition.icon,
            rarity=definition.rarity,
        )
        self.s.add(item)
        await self.s.flush()
        return item
