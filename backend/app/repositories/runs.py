from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import Run, Scenario


class RunRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def get(self, run_id: int) -> Run | None:
        return await self.s.get(Run, run_id)

    async def get_for_update(self, run_id: int) -> Run | None:
        return await self.s.scalar(select(Run).where(Run.id == run_id).with_for_update())

    async def add(self, run: Run) -> Run:
        self.s.add(run)
        await self.s.flush()
        return run

    async def active_for(self, user_id: int, scenario_id: int) -> Run | None:
        return await self.s.scalar(
            select(Run)
            .where(Run.user_id == user_id, Run.scenario_id == scenario_id, Run.status == "active")
            .order_by(Run.id.desc())
            .limit(1)
        )

    async def count_finishes(self, user_id: int, scenario_id: int, exclude_run: int | None = None) -> int:
        query = select(func.count(Run.id)).where(
            Run.user_id == user_id, Run.scenario_id == scenario_id, Run.status == "finished"
        )
        if exclude_run:
            query = query.where(Run.id != exclude_run)
        return await self.s.scalar(query) or 0

    async def finished_endings(
        self, user_id: int, scenario_id: int, exclude_run: int | None = None
    ) -> list[tuple[str | None, str | None]]:
        """Final node and outcome of every finished run of a scenario by the user."""
        query = select(Run.current_node, Run.outcome).where(
            Run.user_id == user_id, Run.scenario_id == scenario_id, Run.status == "finished"
        )
        if exclude_run:
            query = query.where(Run.id != exclude_run)
        return [(node, outcome) for node, outcome in (await self.s.execute(query)).all()]

    async def finished_with_scenarios(self, user_id: int, limit: int | None = None) -> list[tuple[Run, Scenario]]:
        query = (
            select(Run, Scenario)
            .join(Scenario, Scenario.id == Run.scenario_id)
            .where(Run.user_id == user_id, Run.status == "finished")
            .order_by(Run.finished_at.desc())
        )
        if limit:
            query = query.limit(limit)
        return [(r, s) for r, s in (await self.s.execute(query)).all()]

    async def progress_by_scenario(self, user_id: int) -> dict[int, dict]:
        """scenario_id -> {finishes, best_outcome, best_points, active_run_id}"""
        rows = (
            await self.s.execute(
                select(Run.scenario_id, Run.status, Run.outcome, Run.points_awarded, Run.id).where(
                    Run.user_id == user_id, Run.status.in_(("finished", "active"))
                )
            )
        ).all()
        rank = {None: 0, "fail": 1, "partial": 2, "success": 3}
        result: dict[int, dict] = {}
        for scenario_id, status, outcome, points, run_id in rows:
            item = result.setdefault(
                scenario_id, {"finishes": 0, "best_outcome": None, "best_points": 0, "active_run_id": None}
            )
            if status == "active":
                item["active_run_id"] = max(item["active_run_id"] or 0, run_id)
                continue
            item["finishes"] += 1
            if rank[outcome] > rank[item["best_outcome"]]:
                item["best_outcome"] = outcome
            item["best_points"] = max(item["best_points"], points)
        return result

    async def has_active_emergency(self, user_id: int) -> bool:
        return bool(
            await self.s.scalar(
                select(func.count(Run.id)).where(Run.user_id == user_id, Run.status == "active", Run.mode == "emergency")
            )
        )

    async def finished_since(self, since: datetime) -> list[tuple[Run, Scenario]]:
        query = (
            select(Run, Scenario)
            .join(Scenario, Scenario.id == Run.scenario_id)
            .where(Run.status == "finished", Run.finished_at >= since)
        )
        return [(r, s) for r, s in (await self.s.execute(query)).all()]
