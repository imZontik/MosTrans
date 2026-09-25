from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import PointsLedger, Run, Scenario


class AnalyticsRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def runs_since(self, since: datetime, with_decisions: bool = False) -> list[dict]:
        columns = [
            Run.id,
            Run.user_id,
            Run.scenario_id,
            Scenario.title,
            Scenario.category,
            Run.mode,
            Run.outcome,
            Run.loyalty,
            Run.safety,
            Run.finished_at,
        ]
        if with_decisions:
            columns.append(Run.decisions)
        query = (
            select(*columns)
            .join(Scenario, Scenario.id == Run.scenario_id)
            .where(Run.status == "finished", Run.finished_at >= since)
        )
        return [dict(row._mapping) for row in (await self.s.execute(query)).all()]

    async def totals_by_user(self) -> dict[int, dict]:
        success = func.sum(case((Run.outcome == "success", 1), else_=0))
        query = (
            select(
                Run.user_id,
                func.count(Run.id),
                success,
                func.avg(Run.loyalty),
                func.avg(Run.safety),
                func.max(Run.finished_at),
            )
            .where(Run.status == "finished")
            .group_by(Run.user_id)
        )
        return {
            uid: {
                "runs": runs,
                "successes": int(succ or 0),
                "avg_loyalty": round(float(loy)) if loy is not None else None,
                "avg_safety": round(float(saf)) if saf is not None else None,
                "last_run_at": last,
            }
            for uid, runs, succ, loy, saf, last in (await self.s.execute(query)).all()
        }

    async def points_since_by_user(self, since: datetime) -> dict[int, int]:
        query = (
            select(PointsLedger.user_id, func.sum(PointsLedger.amount))
            .where(PointsLedger.created_at >= since)
            .group_by(PointsLedger.user_id)
        )
        return {uid: int(total) for uid, total in (await self.s.execute(query)).all()}
