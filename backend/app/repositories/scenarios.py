from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import Scenario


class ScenarioRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def get(self, scenario_id: int) -> Scenario | None:
        return await self.s.get(Scenario, scenario_id)

    async def get_by_slug(self, slug: str) -> Scenario | None:
        return await self.s.scalar(select(Scenario).where(Scenario.slug == slug))

    async def list(self, *, kind: str | None = None, published_only: bool = True) -> list[Scenario]:
        query = select(Scenario).order_by(Scenario.position, Scenario.difficulty, Scenario.id)
        if kind:
            query = query.where(Scenario.kind == kind)
        if published_only:
            query = query.where(Scenario.is_published.is_(True))
        return list(await self.s.scalars(query))

    async def add(self, scenario: Scenario) -> Scenario:
        self.s.add(scenario)
        await self.s.flush()
        return scenario

    async def delete(self, scenario: Scenario) -> None:
        await self.s.delete(scenario)
