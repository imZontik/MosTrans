from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.services import auth, catalog, emergencies, leaderboard, notifications, play, profile, tournaments
from app.frameworks.api.deps import (
    current_user,
    get_board,
    get_cache,
    get_emergency_queue,
    get_ml,
    get_session,
)
from app.frameworks.api.schemas import AnswerIn, LoginIn, NameDisplayIn, Priority, ReadAllIn, ReadManyIn, RegisterIn, StartRunIn, TournamentAnswerIn
from app.repositories.cache import Cache, EmergencyQueue, TournamentBoard
from app.repositories.ml_gateway import MLGateway
from app.repositories.models import User

router = APIRouter()


# --- auth -------------------------------------------------------------------

@router.post("/auth/login", tags=["auth"], summary="Вход, выдача JWT")
async def login(body: LoginIn, request: Request, session: AsyncSession = Depends(get_session)):
    ip = request.client.host if request.client else "unknown"
    return await auth.login(session, body.email, body.password, ip)


@router.post("/auth/register", tags=["auth"], summary="Регистрация проводника")
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)):
    return await auth.register(session, body.email, body.password, body.full_name, body.position, body.team, body.depot)


# --- profile ----------------------------------------------------------------

@router.get("/me", tags=["profile"], summary="Полный профиль")
async def me(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.profile(session, user, full=True)


@router.patch("/me/name-display", tags=["profile"], summary="Как коллеги видят моё имя")
async def set_name_display(body: NameDisplayIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.set_name_display(session, user, body.name_display)


@router.get("/me/runs", tags=["profile"], summary="История прохождений")
async def my_runs(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.history(session, user.id)


@router.get("/achievements", tags=["profile"], summary="Каталог достижений с прогрессом")
async def achievements(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.achievements_catalogue(session, user)


@router.get("/users/{user_id}", tags=["profile"], summary="Публичный профиль сотрудника")
async def public_profile(user_id: int, _: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.public_profile(session, user_id)


# --- scenarios & runs -------------------------------------------------------

@router.get("/scenarios", tags=["scenarios"], summary="Список доступных сценариев")
async def list_scenarios(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.list_scenarios(session, user)


@router.get("/scenarios/recommended", tags=["scenarios"], summary="Рекомендованный сценарий по слабым местам")
async def recommended(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.recommended(session, user)


@router.get("/scenarios/{scenario_id}", tags=["scenarios"], summary="Сценарий и первый узел графа")
async def get_scenario(scenario_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.get_scenario(session, user, scenario_id)


@router.post("/runs", tags=["runs"], summary="Начать прохождение")
async def start_run(body: StartRunIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.start_run(session, user, body.scenario_id, body.restart)


@router.get("/runs/{run_id}", tags=["runs"], summary="Текущее состояние забега")
async def get_run(run_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.get_run(session, user, run_id)


@router.post("/runs/{run_id}/answer", tags=["runs"], summary="Ответ на узел")
async def answer(
    run_id: int,
    body: AnswerIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    ml: MLGateway = Depends(get_ml),
    cache: Cache = Depends(get_cache),
):
    result = await play.answer(
        session, ml, user, run_id, node_id=body.node_id, action=body.action, choice_id=body.choice_id, text=body.text
    )
    if result["run"]["status"] == "finished":
        await leaderboard.invalidate(cache)
    return result


@router.post("/runs/{run_id}/abandon", tags=["runs"], summary="Прервать забег")
async def abandon(run_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.abandon_run(session, user, run_id)


# --- leaderboard ------------------------------------------------------------

@router.get("/leaderboard", tags=["leaderboard"], summary="Рейтинг")
async def get_leaderboard(
    period: Literal["week", "all"] = "week",
    scope: Literal["company", "depot", "team"] = "company",
    unit: str | None = Query(default=None, max_length=255, description="Депо или бригада; по умолчанию — своя"),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
):
    return await leaderboard.leaderboard(session, cache, user, period, limit, scope, unit)


@router.get("/leaderboard/units", tags=["leaderboard"], summary="Доступные депо и бригады")
async def leaderboard_units(_: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Депо и бригады, доступные для `scope`/`unit`."""
    return await leaderboard.units(session)


# --- tournaments ------------------------------------------------------------

@router.get("/tournaments/current", tags=["tournaments"], summary="Текущий турнир")
async def current_tournament(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.current(session, board, user)


@router.get("/tournaments", tags=["tournaments"], summary="Последние турниры")
async def recent_tournaments(_: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await tournaments.recent(session)


@router.post("/tournaments/{tournament_id}/join", tags=["tournaments"], summary="Участие в турнире")
async def join_tournament(
    tournament_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.join(session, board, user, tournament_id)


@router.post("/tournaments/{tournament_id}/answer", tags=["tournaments"], summary="Ответ на вопрос турнира")
async def tournament_answer(
    tournament_id: int,
    body: TournamentAnswerIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.answer(session, board, user, tournament_id, body.index, body.option)


@router.get("/tournaments/{tournament_id}/leaderboard", tags=["tournaments"], summary="Живая таблица турнира")
async def tournament_leaderboard(
    tournament_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.leaderboard(session, board, user, tournament_id, limit)


# --- emergencies ------------------------------------------------------------

@router.get("/emergencies/pending", tags=["emergencies"], summary="Ожидающее экстренное событие")
async def pending_emergency(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    queue: EmergencyQueue = Depends(get_emergency_queue),
):
    """Ожидающее экстренное событие для сотрудника. Опрашивать поллингом раз в ~20 секунд."""
    return await emergencies.pending(session, queue, user)


# --- notifications ----------------------------------------------------------

@router.get("/notifications", tags=["notifications"], summary="Входящие уведомления")
async def notification_list(
    unread: bool = False,
    priority: Priority | None = None,
    before: int | None = Query(None, description="id последнего уведомления предыдущей страницы"),
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    return await notifications.inbox(session, user, unread=unread, priority=priority, before=before, limit=limit)


@router.get("/notifications/summary", tags=["notifications"], summary="Счётчики непрочитанных")
async def notification_summary(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Счётчики непрочитанных и самое свежее непрочитанное уведомление — то, что опрашивает «колокольчик»."""
    return await notifications.summary(session, user)


@router.post("/notifications/read", tags=["notifications"], summary="Отметить увиденные прочитанными")
async def notification_read_many(
    body: ReadManyIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
):
    """Уведомления, которые показались сотруднику на экране, — одним запросом. Чужие id молча пропускаются."""
    return await notifications.read_many(session, user, body.ids)


@router.post("/notifications/read-all", tags=["notifications"], summary="Отметить всё прочитанным")
async def notification_read_all(
    body: ReadAllIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
):
    return await notifications.read_all(session, user, body.priority)


@router.post("/notifications/{notification_id}/read", tags=["notifications"], summary="Отметить уведомление прочитанным")
async def notification_read(
    notification_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
):
    return await notifications.read(session, user, notification_id)
