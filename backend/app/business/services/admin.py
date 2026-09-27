"""Admin panel: scenario authoring (with LLM drafts), staff management, assistant."""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.business.catalog import CATEGORIES, POSITIONS, ROLES
from app.business.engine import validate_graph
from app.business.errors import AppError, Conflict, NotFound
from app.business.services import analytics
from app.business.services import notifications
from app.business.services.presenters import scenario_brief, user_full
from app.repositories.cache import Cache
from app.repositories.ml_gateway import MLGateway
from app.repositories.models import Scenario, User
from app.repositories.scenarios import ScenarioRepository
from app.repositories.users import UserRepository


def _slugify(title: str) -> str:
    table = str.maketrans(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
        "abvgdeejzijklmnoprstufhccss_y_eua",
    )
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower().translate(table)).strip("-")
    return slug[:60] or "scenario"


def scenario_full(s: Scenario) -> dict:
    return {**scenario_brief(s), "graph": s.graph, "updated_at": s.updated_at}


async def list_scenarios(session: AsyncSession) -> list[dict]:
    return [scenario_full(s) for s in await ScenarioRepository(session).list(published_only=False)]


async def get_scenario(session: AsyncSession, scenario_id: int) -> dict:
    s = await ScenarioRepository(session).get(scenario_id)
    if s is None:
        raise NotFound("Сценарий не найден")
    return scenario_full(s)


def _check(data: dict) -> None:
    if data.get("category") not in CATEGORIES:
        raise AppError("Неизвестная категория")
    if data.get("position") not in POSITIONS:
        raise AppError("Неизвестная должность")
    if data.get("kind") not in ("training", "emergency"):
        raise AppError("Тип сценария: training | emergency")
    errors = validate_graph(data.get("graph"))
    if errors:
        raise AppError("Сценарий содержит ошибки: " + "; ".join(errors[:5]), 422)


async def create_scenario(session: AsyncSession, author: User, data: dict) -> dict:
    _check(data)
    repo = ScenarioRepository(session)
    slug = data.get("slug") or _slugify(data["title"])
    if await repo.get_by_slug(slug):
        slug = f"{slug}-{len(await repo.list(published_only=False)) + 1}"
    s = await repo.add(Scenario(**{**data, "slug": slug}, created_by=author.id))
    if s.is_published:
        await notifications.scenario_published(session, s)
    await session.commit()
    return scenario_full(s)


async def update_scenario(session: AsyncSession, scenario_id: int, data: dict) -> dict:
    repo = ScenarioRepository(session)
    s = await repo.get(scenario_id)
    if s is None:
        raise NotFound("Сценарий не найден")
    merged = {**scenario_full(s), **data}
    _check(merged)
    was_published = s.is_published
    for field in ("title", "description", "category", "position", "kind", "difficulty", "cover", "estimated_minutes", "graph", "is_published"):
        if field in data:
            setattr(s, field, data[field])
    if s.is_published and not was_published:
        await notifications.scenario_published(session, s)
    await session.commit()
    return scenario_full(s)


def validate(graph: dict) -> dict:
    return {"errors": validate_graph(graph)}


async def generate_draft(ml: MLGateway, spec: dict) -> dict:
    data = await ml.generate_scenario(spec)
    if data is None:
        raise AppError("ML-сервис недоступен — попробуйте позже", 503)
    graph = data.get("graph") or {}
    return {**data, "errors": validate_graph(graph)}


async def update_employee(session: AsyncSession, user_id: int, data: dict) -> dict:
    user = await UserRepository(session).get(user_id)
    if user is None:
        raise NotFound("Сотрудник не найден")
    old_position, old_unit = user.position, (user.team, user.depot)
    if "position" in data:
        if data["position"] not in POSITIONS:
            raise AppError("Неизвестная должность")
        user.position = data["position"]
    if "role" in data:
        if data["role"] not in ROLES:
            raise AppError("Неизвестная роль")
        user.role = data["role"]
    if "team" in data:
        user.team = data["team"]
    if "depot" in data:
        user.depot = data["depot"]
    if user.position != old_position:
        await notifications.position_changed(session, user, old_position)
    if (user.team, user.depot) != old_unit:
        await notifications.unit_changed(session, user)
    await session.commit()
    return user_full(user)


async def delete_scenario(session: AsyncSession, scenario_id: int) -> None:
    repo = ScenarioRepository(session)
    s = await repo.get(scenario_id)
    if s is None:
        raise NotFound("Сценарий не найден")
    if s.is_published:
        raise Conflict("Сначала снимите сценарий с публикации")
    await repo.delete(s)
    await session.commit()


async def assistant(session: AsyncSession, cache: Cache, ml: MLGateway, message: str) -> dict:
    """Instructor assistant: answers questions about employees with live data."""
    snapshot = {
        "overview": await analytics.overview(session, cache),
        "employees": [
            {
                "id": e["id"],
                "name": e["full_name"],
                "position": e["position_title"],
                "team": e["team"],
                "level": e["level"],
                "points": e["points"],
                "points_week": e["points_week"],
                "runs": e["runs"],
                "success_rate": e["success_rate"],
                "avg_loyalty": e["avg_loyalty"],
                "avg_safety": e["avg_safety"],
                "safety_30d": e["safety_30d"],
                "safety_trend": e["safety_trend"],
                "last_active_at": e["last_active_at"],
            }
            for e in await analytics.employees(session)
        ],
    }
    data = await ml.assistant({"message": message, "snapshot": snapshot})
    if data is None:
        return {"answer": "ИИ-ассистент сейчас недоступен. Данные по сотрудникам доступны во вкладке «Сотрудники».", "table": None, "provider": "offline"}
    return data
