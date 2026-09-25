from collections.abc import AsyncIterator

import jwt
from fastapi import Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.catalog import STAFF_ROLES
from app.business.errors import Forbidden, Unauthorized
from app.frameworks.database import SessionLocal
from app.frameworks.security import decode_access_token
from app.frameworks.valkey import get_valkey
from app.repositories.cache import Cache, EmergencyQueue, TournamentBoard
from app.repositories.ml_gateway import MLGateway
from app.repositories.models import User
from app.repositories.users import UserRepository


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def get_cache() -> Cache:
    return Cache(get_valkey())


def get_board() -> TournamentBoard:
    return TournamentBoard(get_valkey())


def get_emergency_queue() -> EmergencyQueue:
    return EmergencyQueue(get_valkey())


def get_ml() -> MLGateway:
    return MLGateway()


async def current_user(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None, include_in_schema=False),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Bearer token from the header; ``?token=`` is accepted for web-view embeds."""
    raw = token
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization[7:]
    if not raw:
        raise Unauthorized("Требуется авторизация")
    try:
        payload = decode_access_token(raw)
    except jwt.PyJWTError as exc:
        raise Unauthorized("Сессия истекла, войдите снова") from exc
    users = UserRepository(session)
    user = await users.get(int(payload["sub"]))
    if user is None:
        raise Unauthorized("Пользователь не найден")
    cache = get_cache()
    if await cache.r.set(f"active:{user.id}", "1", ex=60, nx=True):
        await users.touch(user.id)
        await session.commit()
    return user


async def staff_user(user: User = Depends(current_user)) -> User:
    if user.role not in STAFF_ROLES:
        raise Forbidden("Доступно только руководителям и HR")
    return user
