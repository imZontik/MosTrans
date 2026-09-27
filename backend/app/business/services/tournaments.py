"""Weekly tournament: everyone joins at the same time and answers timed questions.

Top-10 get a trophy for the week and +100 competency points (winner +50 more).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.business import economy
from app.business.achievements import tournament_achievements, week_number
from app.business import notifications as msg
from app.business.errors import AppError, Conflict, NotFound
from app.business.services import notifications
from app.business.services.presenters import user_brief
from app.business.tournament import iso_week, pick_questions, public_question, status_of, weekly_window
from app.frameworks.config import get_settings
from app.frameworks.metrics import ACHIEVEMENTS, ACTIVE_TOURNAMENT_PLAYERS, POINTS_AWARDED, TOURNAMENT_ANSWERS
from app.repositories.achievements import AchievementRepository
from app.repositories.cache import TournamentBoard
from app.repositories.models import Tournament, TournamentEntry, User
from app.repositories.points import PointsRepository
from app.repositories.tournaments import TournamentRepository
from app.repositories.users import UserRepository
from app.seed.content.tournament_questions import QUESTION_POOL

GRACE_SEC = 2.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


def tournament_view(t: Tournament, participants: int, now: datetime | None = None) -> dict:
    now = now or _now()
    return {
        "id": t.id,
        "title": t.title,
        "week": t.week,
        "week_number": week_number(t.week),
        "starts_at": t.starts_at,
        "ends_at": t.ends_at,
        "status": status_of(t.starts_at, t.ends_at, now),
        "finalized": t.finalized,
        "questions_total": len(t.questions),
        "participants": participants,
        "server_now": now,
        "rewards": {
            "top_n": economy.TOURNAMENT_TOP_N,
            "top_bonus": economy.TOURNAMENT_TOP10_BONUS,
            "winner_extra": economy.TOURNAMENT_WINNER_EXTRA,
        },
    }


def entry_view(e: TournamentEntry | None, total: int) -> dict | None:
    if e is None:
        return None
    return {
        "score": e.score,
        "correct": e.correct,
        "answered": len(e.answers or []),
        "total": total,
        "finished": e.finished_at is not None,
        "place": e.place,
    }


def _question(t: Tournament, e: TournamentEntry) -> dict | None:
    if e.finished_at is not None or e.current_index >= len(t.questions):
        return None
    q = public_question(t.questions[e.current_index], e.current_index, len(t.questions))
    q["deadline"] = e.question_issued_at + timedelta(seconds=q["timer"])
    q["server_now"] = _now()
    return q


async def _ensure_board(repo: TournamentRepository, board: TournamentBoard, t: Tournament) -> None:
    """Rebuild the live leaderboard from PostgreSQL if Valkey lost it."""
    if await board.exists(t.id):
        return
    for e in await repo.entries(t.id):
        await board.set_score(t.id, e.user_id, e.score)


async def _participants(repo: TournamentRepository, board: TournamentBoard, t: Tournament) -> int:
    if await board.exists(t.id):
        return await board.size(t.id)
    return len(await repo.entries(t.id))


async def current(session: AsyncSession, board: TournamentBoard, user: User) -> dict:
    repo = TournamentRepository(session)
    t = await repo.current(_now())
    if t is None:
        return {"tournament": None, "entry": None, "question": None}
    entry = await repo.entry(t.id, user.id)
    return {
        "tournament": tournament_view(t, await _participants(repo, board, t)),
        "entry": entry_view(entry, len(t.questions)),
        "question": _question(t, entry) if entry else None,
    }


async def recent(session: AsyncSession) -> list[dict]:
    repo = TournamentRepository(session)
    result = []
    for t in await repo.list_recent(10):
        entries = await repo.entries(t.id)
        winners = []
        if t.finalized:
            users = await UserRepository(session).get_many([e.user_id for e in entries[:3]])
            winners = [
                {"place": e.place, "score": e.score, **user_brief(users[e.user_id])}
                for e in entries[:3]
                if e.user_id in users
            ]
        result.append({**tournament_view(t, len(entries)), "winners": winners})
    return result


async def join(session: AsyncSession, board: TournamentBoard, user: User, tournament_id: int) -> dict:
    repo = TournamentRepository(session)
    t = await repo.get(tournament_id)
    if t is None:
        raise NotFound("Турнир не найден")
    now = _now()
    if status_of(t.starts_at, t.ends_at, now) != "live":
        raise AppError("Турнир сейчас не идёт")
    await _ensure_board(repo, board, t)
    entry = await repo.entry(t.id, user.id)
    if entry is None:
        entry = await repo.add_entry(
            TournamentEntry(tournament_id=t.id, user_id=user.id, question_issued_at=now, answers=[])
        )
        await board.set_score(t.id, user.id, 0)
        await session.commit()
    elif entry.finished_at is not None:
        raise Conflict("Вы уже прошли этот турнир — следите за таблицей лидеров")
    return {"entry": entry_view(entry, len(t.questions)), "question": _question(t, entry)}


async def answer(
    session: AsyncSession,
    board: TournamentBoard,
    user: User,
    tournament_id: int,
    index: int,
    option: int | None,
) -> dict:
    repo = TournamentRepository(session)
    t = await repo.get(tournament_id)
    if t is None:
        raise NotFound("Турнир не найден")
    entry = await repo.entry(t.id, user.id, lock=True)
    if entry is None:
        raise AppError("Сначала присоединитесь к турниру")
    if entry.finished_at is not None:
        raise Conflict("Турнир для вас уже завершён")
    if index != entry.current_index:
        raise Conflict("Этот вопрос уже пройден")
    now = _now()
    if now > t.ends_at + timedelta(seconds=GRACE_SEC):
        raise AppError("Время турнира вышло")

    q = t.questions[index]
    timer = q.get("timer", 15)
    elapsed = (now - entry.question_issued_at).total_seconds()
    timed_out = option is None or elapsed > timer + GRACE_SEC
    correct = not timed_out and option == q["correct"]
    points = economy.tournament_answer_points(correct, elapsed, timer)
    TOURNAMENT_ANSWERS.labels(correct=str(correct)).inc()

    entry.answers = [
        *(entry.answers or []),
        {"index": index, "option": option, "correct": correct, "points": points, "elapsed": round(elapsed, 2)},
    ]
    entry.score += points
    entry.correct += int(correct)
    entry.current_index += 1
    if entry.current_index >= len(t.questions):
        entry.finished_at = now
    else:
        entry.question_issued_at = now
    await session.commit()
    await _ensure_board(repo, board, t)
    await board.set_score(t.id, user.id, entry.score)

    return {
        "correct": correct,
        "timed_out": timed_out,
        "correct_option": q["correct"],
        "explanation": q.get("explanation", ""),
        "points": points,
        "entry": entry_view(entry, len(t.questions)),
        "rank": await board.rank(t.id, user.id),
        "question": _question(t, entry),
    }


async def leaderboard(session: AsyncSession, board: TournamentBoard, user: User, tournament_id: int, limit: int) -> dict:
    repo = TournamentRepository(session)
    t = await repo.get(tournament_id)
    if t is None:
        raise NotFound("Турнир не найден")
    if await board.exists(t.id) and not t.finalized:
        rows = await board.top(t.id, limit)
        my_rank = await board.rank(t.id, user.id)
        total = await board.size(t.id)
    else:
        entries = await repo.entries(t.id)
        rows = [(e.user_id, e.score) for e in entries[:limit]]
        my_rank = next((i + 1 for i, e in enumerate(entries) if e.user_id == user.id), None)
        total = len(entries)
    users = await UserRepository(session).get_many([uid for uid, _ in rows])
    entries_view = [
        {"rank": i + 1, "score": score, "is_me": uid == user.id, **user_brief(users[uid])}
        for i, (uid, score) in enumerate(rows)
        if uid in users
    ]
    ACTIVE_TOURNAMENT_PLAYERS.set(total)
    return {"tournament_id": t.id, "entries": entries_view, "my_rank": my_rank, "participants": total}


async def finalize(session: AsyncSession, t: Tournament) -> list[dict]:
    """Assign places, trophies and bonus points. Idempotent."""
    if t.finalized:
        return []
    repo = TournamentRepository(session)
    points = PointsRepository(session)
    achievements = AchievementRepository(session)
    awarded = []
    entries = await repo.entries(t.id)
    for place, entry in enumerate(entries, start=1):
        entry.place = place
        bonus = economy.tournament_reward(place)
        result = msg.tournament_result(t.id, t.title, place, len(entries), entry.score, bonus)
        await notifications.notify(session, [entry.user_id], result)
        if bonus:
            await points.award(entry.user_id, bonus, "tournament", f"tournament:{t.id}", at=t.ends_at)
            POINTS_AWARDED.labels(reason="tournament").inc(bonus)
        owned = await achievements.codes_for(entry.user_id)
        for definition in tournament_achievements(t.week, place):
            if definition.code not in owned:
                await achievements.grant(entry.user_id, definition)
                ACHIEVEMENTS.labels(code="tournament").inc()
        if bonus:
            awarded.append({"user_id": entry.user_id, "place": place, "bonus": bonus})
    t.finalized = True
    await session.commit()
    return awarded


async def create(session: AsyncSession, *, title: str | None, starts_at: datetime, duration_min: int) -> Tournament:
    week = iso_week(starts_at)
    settings = get_settings()
    t = await TournamentRepository(session).add(
        Tournament(
            title=title or f"Турнир {week_number(week)}-й недели",
            week=week,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(minutes=duration_min),
            questions=pick_questions(QUESTION_POOL, settings.tournament_questions, f"{week}:{starts_at.isoformat()}"),
        )
    )
    await session.commit()
    return t


async def ensure_weekly(session: AsyncSession, now: datetime) -> Tournament | None:
    """Make sure this week's tournament exists (scheduled per settings)."""
    settings = get_settings()
    week = iso_week(now)
    if await TournamentRepository(session).by_week(week):
        return None
    starts_at, _ = weekly_window(now, settings.tournament_weekday, settings.tournament_hour, settings.tournament_duration_min)
    return await create(session, title=None, starts_at=starts_at, duration_min=settings.tournament_duration_min)


async def start_now(session: AsyncSession, tournament_id: int, duration_min: int) -> Tournament:
    t = await TournamentRepository(session).get(tournament_id)
    if t is None:
        raise NotFound("Турнир не найден")
    if t.finalized:
        raise Conflict("Турнир уже подведён")
    now = _now()
    t.starts_at = now
    t.ends_at = now + timedelta(minutes=duration_min)
    await session.commit()
    return t


async def finish_now(session: AsyncSession, tournament_id: int) -> list[dict]:
    t = await TournamentRepository(session).get(tournament_id)
    if t is None:
        raise NotFound("Турнир не найден")
    now = _now()
    if t.ends_at > now:
        t.ends_at = now
    if t.starts_at > now:
        t.starts_at = now
    return await finalize(session, t)


async def admin_list(session: AsyncSession) -> list[dict]:
    return await recent(session)


async def scheduler_tick(session: AsyncSession) -> None:
    now = _now()
    await ensure_weekly(session, now)
    for t in await TournamentRepository(session).to_finalize(now):
        await finalize(session, t)
