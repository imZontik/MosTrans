from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.services import auth, catalog, emergencies, leaderboard, play, profile, tournaments
from app.frameworks.api.deps import (
    current_user,
    get_board,
    get_cache,
    get_emergency_queue,
    get_ml,
    get_session,
)
from app.frameworks.api.schemas import AnswerIn, LoginIn, RegisterIn, StartRunIn, TournamentAnswerIn
from app.repositories.cache import Cache, EmergencyQueue, TournamentBoard
from app.repositories.ml_gateway import MLGateway
from app.repositories.models import User

router = APIRouter()


# --- auth -------------------------------------------------------------------

@router.post("/auth/login", tags=["auth"])
async def login(body: LoginIn, request: Request, session: AsyncSession = Depends(get_session)):
    ip = request.client.host if request.client else "unknown"
    return await auth.login(session, body.email, body.password, ip)


@router.post("/auth/register", tags=["auth"])
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)):
    return await auth.register(session, body.email, body.password, body.full_name, body.position, body.team, body.depot)


# --- profile ----------------------------------------------------------------

@router.get("/me", tags=["profile"])
async def me(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.profile(session, user, full=True)


@router.get("/me/runs", tags=["profile"])
async def my_runs(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.history(session, user.id)


@router.get("/achievements", tags=["profile"])
async def achievements(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.achievements_catalogue(session, user)


@router.get("/users/{user_id}", tags=["profile"])
async def public_profile(user_id: int, _: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await profile.public_profile(session, user_id)


# --- scenarios & runs -------------------------------------------------------

@router.get("/scenarios", tags=["scenarios"])
async def list_scenarios(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.list_scenarios(session, user)


@router.get("/scenarios/recommended", tags=["scenarios"])
async def recommended(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.recommended(session, user)


@router.get("/scenarios/{scenario_id}", tags=["scenarios"])
async def get_scenario(scenario_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await catalog.get_scenario(session, user, scenario_id)


@router.post("/runs", tags=["runs"])
async def start_run(body: StartRunIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.start_run(session, user, body.scenario_id, body.restart)


@router.get("/runs/{run_id}", tags=["runs"])
async def get_run(run_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.get_run(session, user, run_id)


@router.post("/runs/{run_id}/answer", tags=["runs"])
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


@router.post("/runs/{run_id}/abandon", tags=["runs"])
async def abandon(run_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await play.abandon_run(session, user, run_id)


# --- leaderboard ------------------------------------------------------------

@router.get("/leaderboard", tags=["leaderboard"])
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


@router.get("/leaderboard/units", tags=["leaderboard"])
async def leaderboard_units(_: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Depots and brigades available for ``scope``/``unit``."""
    return await leaderboard.units(session)


# --- tournaments ------------------------------------------------------------

@router.get("/tournaments/current", tags=["tournaments"])
async def current_tournament(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.current(session, board, user)


@router.get("/tournaments", tags=["tournaments"])
async def recent_tournaments(_: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await tournaments.recent(session)


@router.post("/tournaments/{tournament_id}/join", tags=["tournaments"])
async def join_tournament(
    tournament_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.join(session, board, user, tournament_id)


@router.post("/tournaments/{tournament_id}/answer", tags=["tournaments"])
async def tournament_answer(
    tournament_id: int,
    body: TournamentAnswerIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.answer(session, board, user, tournament_id, body.index, body.option)


@router.get("/tournaments/{tournament_id}/leaderboard", tags=["tournaments"])
async def tournament_leaderboard(
    tournament_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
):
    return await tournaments.leaderboard(session, board, user, tournament_id, limit)


# --- emergencies ------------------------------------------------------------

@router.get("/emergencies/pending", tags=["emergencies"])
async def pending_emergency(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    queue: EmergencyQueue = Depends(get_emergency_queue),
):
    return await emergencies.pending(session, queue, user)
