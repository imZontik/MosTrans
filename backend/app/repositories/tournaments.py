from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import Tournament, TournamentEntry


class TournamentRepository:
    def __init__(self, session: AsyncSession):
        self.s = session

    async def get(self, tournament_id: int) -> Tournament | None:
        return await self.s.get(Tournament, tournament_id)

    async def add(self, tournament: Tournament) -> Tournament:
        self.s.add(tournament)
        await self.s.flush()
        return tournament

    async def list_recent(self, limit: int = 20) -> list[Tournament]:
        return list(await self.s.scalars(select(Tournament).order_by(Tournament.starts_at.desc()).limit(limit)))

    async def current(self, now: datetime) -> Tournament | None:
        """The live tournament, otherwise the nearest upcoming, otherwise the latest one."""
        live = await self.s.scalar(
            select(Tournament).where(Tournament.starts_at <= now, Tournament.ends_at > now).order_by(Tournament.starts_at)
        )
        if live:
            return live
        upcoming = await self.s.scalar(
            select(Tournament).where(Tournament.starts_at > now).order_by(Tournament.starts_at).limit(1)
        )
        if upcoming:
            return upcoming
        return await self.s.scalar(select(Tournament).order_by(Tournament.ends_at.desc()).limit(1))

    async def by_week(self, week: str) -> Tournament | None:
        return await self.s.scalar(select(Tournament).where(Tournament.week == week).limit(1))

    async def starting_between(self, start: datetime, end: datetime) -> list[Tournament]:
        """Not finished tournaments whose start falls into [start, end)."""
        return list(
            await self.s.scalars(
                select(Tournament).where(
                    Tournament.starts_at >= start, Tournament.starts_at < end, Tournament.finalized.is_(False)
                )
            )
        )

    async def to_finalize(self, now: datetime) -> list[Tournament]:
        return list(
            await self.s.scalars(select(Tournament).where(Tournament.ends_at <= now, Tournament.finalized.is_(False)))
        )

    async def entry(self, tournament_id: int, user_id: int, lock: bool = False) -> TournamentEntry | None:
        query = select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id, TournamentEntry.user_id == user_id
        )
        if lock:
            query = query.with_for_update()
        return await self.s.scalar(query)

    async def entries(self, tournament_id: int) -> list[TournamentEntry]:
        return list(
            await self.s.scalars(
                select(TournamentEntry)
                .where(TournamentEntry.tournament_id == tournament_id)
                .order_by(
                    TournamentEntry.score.desc(),
                    TournamentEntry.finished_at.asc().nulls_last(),
                    TournamentEntry.id,
                )
            )
        )

    async def add_entry(self, entry: TournamentEntry) -> TournamentEntry:
        self.s.add(entry)
        await self.s.flush()
        return entry
