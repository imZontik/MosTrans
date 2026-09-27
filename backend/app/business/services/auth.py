from sqlalchemy.ext.asyncio import AsyncSession

from app.business.errors import Conflict, TooManyRequests, Unauthorized
from app.frameworks.security import create_access_token, hash_password, verify_password
from app.repositories.models import User
from app.business.catalog import POSITIONS
from app.repositories.cache import RateLimiter
from app.frameworks.valkey import get_valkey
from app.repositories.users import UserRepository
from app.business.services.presenters import user_full
from app.business import notifications as msg
from app.business.services import notifications


async def login(session: AsyncSession, email: str, password: str, client_ip: str) -> dict:
    limiter = RateLimiter(get_valkey())
    if not await limiter.hit(f"login:{client_ip}", limit=20, window_sec=60):
        raise TooManyRequests("Слишком много попыток входа. Подождите минуту.")
    user = await UserRepository(session).get_by_email(email.strip())
    if user is None or not verify_password(password, user.password_hash):
        raise Unauthorized("Неверная почта или пароль")
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer", "user": user_full(user)}


async def register(
    session: AsyncSession, email: str, password: str, full_name: str, position: str, team: str, depot: str = ""
) -> dict:
    repo = UserRepository(session)
    if await repo.get_by_email(email.strip()):
        raise Conflict("Пользователь с такой почтой уже зарегистрирован")
    if position not in POSITIONS:
        position = "conductor"
    user = await repo.add(
        User(
            email=email.strip().lower(),
            password_hash=hash_password(password),
            full_name=full_name.strip(),
            role="employee",
            position=position,
            team=team.strip(),
            depot=depot.strip(),
        )
    )
    await notifications.notify(session, [user.id], msg.welcome())
    await session.commit()
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer", "user": user_full(user)}
