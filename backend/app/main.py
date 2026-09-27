import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text

from app.business.errors import AppError
from app.business.services import notifications, tournaments
from app.frameworks.api.routers import admin, player
from app.frameworks.config import get_settings
from app.frameworks.database import SessionLocal, engine
from app.frameworks.valkey import close_valkey, get_valkey
from app.seed.demo import seed

log = logging.getLogger("magistral")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

SEED_LOCK = 400_400


async def prepare_database() -> None:
    """Schema is managed by Alembic (app.frameworks.migrate runs before the API); here only demo data."""
    if get_settings().seed_demo_data:
        async with SessionLocal() as session:
            await session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": SEED_LOCK})
            await seed(session)


async def scheduler() -> None:
    """Weekly tournaments (create the next one, finalize finished ones) and scheduled notifications."""
    interval = get_settings().scheduler_interval_sec
    valkey = get_valkey()
    while True:
        try:
            if await valkey.set("scheduler:lock", "1", ex=interval - 1, nx=True):
                async with SessionLocal() as session:
                    await tournaments.scheduler_tick(session)
                async with SessionLocal() as session:
                    await notifications.scheduler_tick(session)
        except Exception:  # keep the loop alive
            log.exception("Scheduler tick failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await prepare_database()
    task = asyncio.create_task(scheduler())
    yield
    task.cancel()
    await close_valkey()
    await engine.dispose()


TAGS_METADATA = [
    {"name": "auth", "description": "Вход и регистрация. JWT — в `Authorization: Bearer` или `?token=`."},
    {"name": "profile", "description": "Профиль: уровень, очки, достижения, рейтинг, история прохождений."},
    {"name": "scenarios", "description": "Сценарии обучения с учётом должности, рекомендации и граф сценария."},
    {"name": "runs", "description": "Прохождение сценария: старт, ответы, текущее состояние, итог с начислением очков."},
    {"name": "leaderboard", "description": "Рейтинг по периодам (`week`/`all`) и разрезам (`company`/`depot`/`team`)."},
    {"name": "tournaments", "description": "Еженедельные турниры: текущий вопрос, участие, ответы, таблица."},
    {"name": "emergencies", "description": "Экстренные события для проводника (периодический опрос)."},
    {"name": "notifications", "description": "Уведомления сотрудника и массовые рассылки для руководителей."},
    {"name": "admin", "description": "Админ-панель (роли `lead`/`admin`): аналитика, сотрудники, сценарии, турниры, отчёты, ИИ."},
    {"name": "reports", "description": "Отчёт о прогрессе обучения для HR/LMS (JSON и Excel)."},
    {"name": "system", "description": "Служебные эндпоинты."},
]

app = FastAPI(
    title="Магистраль 400 API",
    description="Геймифицированное обучение проводников ВСМ.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    openapi_tags=TAGS_METADATA,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/api/health", tags=["system"])
async def health():
    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
    await get_valkey().ping()
    return {"status": "ok"}


app.include_router(player.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
Instrumentator(excluded_handlers=["/metrics", "/api/health"]).instrument(app).expose(app, include_in_schema=False)
