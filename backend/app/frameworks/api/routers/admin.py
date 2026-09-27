from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.services import admin, analytics, emergencies, notifications, reports, tournaments
from app.business.tournament import MSK
from app.frameworks.api.deps import get_board, get_cache, get_emergency_queue, get_ml, get_session, staff_user
from app.frameworks.api.schemas import (
    AssistantIn,
    AudienceIn,
    BroadcastIn,
    DispatchIn,
    EmployeePatch,
    GenerateIn,
    GraphIn,
    ScenarioIn,
    ScenarioPatch,
    StartNowIn,
    TournamentCreateIn,
)
from app.frameworks.xlsx import training_report_xlsx
from app.repositories.cache import Cache, EmergencyQueue, TournamentBoard
from app.repositories.ml_gateway import MLGateway
from app.repositories.models import User

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(staff_user)])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ReportDays = Query(30, ge=1, le=365, description="Период отчёта в днях")


@router.get("/analytics/overview", summary="Пульс команды за 30 дней")
async def overview(session: AsyncSession = Depends(get_session), cache: Cache = Depends(get_cache)):
    """Активность, успешность и частые ошибки команды за 30 дней."""
    return await analytics.overview(session, cache)


@router.get("/employees", summary="Таблица сотрудников")
async def employees(search: str | None = None, session: AsyncSession = Depends(get_session)):
    return await analytics.employees(session, search)


@router.get("/employees/{user_id}", summary="Детали сотрудника")
async def employee(user_id: int, session: AsyncSession = Depends(get_session)):
    """Компетенции, история прохождений и квалификация сотрудника."""
    return await analytics.employee_detail(session, user_id)


@router.patch("/employees/{user_id}", summary="Обновить должность/роль/бригаду/депо")
async def update_employee(user_id: int, body: EmployeePatch, session: AsyncSession = Depends(get_session)):
    """Синхронизация со справочником кадров: обновить должность, роль, бригаду или депо."""
    return await admin.update_employee(session, user_id, body.model_dump(exclude_none=True))


@router.get("/scenarios", summary="Все сценарии")
async def scenarios(session: AsyncSession = Depends(get_session)):
    return await admin.list_scenarios(session)


@router.get("/scenarios/{scenario_id}", summary="Сценарий")
async def scenario(scenario_id: int, session: AsyncSession = Depends(get_session)):
    return await admin.get_scenario(session, scenario_id)


@router.post("/scenarios", summary="Создать сценарий (JSON-граф)")
async def create_scenario(
    body: ScenarioIn, user: User = Depends(staff_user), session: AsyncSession = Depends(get_session)
):
    return await admin.create_scenario(session, user, body.model_dump())


@router.patch("/scenarios/{scenario_id}", summary="Обновить сценарий")
async def update_scenario(scenario_id: int, body: ScenarioPatch, session: AsyncSession = Depends(get_session)):
    return await admin.update_scenario(session, scenario_id, body.model_dump(exclude_none=True))


@router.delete("/scenarios/{scenario_id}", status_code=204, summary="Удалить сценарий")
async def delete_scenario(scenario_id: int, session: AsyncSession = Depends(get_session)):
    await admin.delete_scenario(session, scenario_id)


@router.post("/scenarios/validate", summary="Проверить граф")
async def validate(body: GraphIn):
    return admin.validate(body.graph)


@router.post("/scenarios/generate", summary="Черновик сценария по ТЗ через ИИ")
async def generate(body: GenerateIn, ml: MLGateway = Depends(get_ml)):
    return await admin.generate_draft(ml, body.model_dump())


@router.get("/tournaments", summary="Список турниров")
async def list_tournaments(session: AsyncSession = Depends(get_session)):
    return await tournaments.admin_list(session)


@router.post("/tournaments", summary="Создать турнир")
async def create_tournament(body: TournamentCreateIn, session: AsyncSession = Depends(get_session)):
    t = await tournaments.create(session, title=body.title, starts_at=body.starts_at, duration_min=body.duration_min)
    return tournaments.tournament_view(t, 0)


@router.post("/tournaments/{tournament_id}/start-now", summary="Запустить турнир сейчас")
async def start_now(tournament_id: int, body: StartNowIn, session: AsyncSession = Depends(get_session)):
    t = await tournaments.start_now(session, tournament_id, body.duration_min)
    return tournaments.tournament_view(t, 0)


@router.post("/tournaments/{tournament_id}/finish", summary="Финализировать турнир, начислить призы")
async def finish(
    tournament_id: int,
    session: AsyncSession = Depends(get_session),
    board: TournamentBoard = Depends(get_board),
    cache: Cache = Depends(get_cache),
):
    awarded = await tournaments.finish_now(session, tournament_id)
    await cache.delete_prefix("leaderboard:")
    return {"awarded": awarded}


@router.get("/emergencies", summary="Список спецсобытий")
async def list_emergencies(session: AsyncSession = Depends(get_session)):
    return await emergencies.list_emergencies(session)


@router.post("/emergencies/dispatch", summary="Отправить спецсобытие")
async def dispatch(
    body: DispatchIn,
    session: AsyncSession = Depends(get_session),
    queue: EmergencyQueue = Depends(get_emergency_queue),
):
    return await emergencies.dispatch(
        session, queue, scenario_id=body.scenario_id, user_ids=body.user_ids, message=body.message
    )


@router.get("/broadcasts", tags=["notifications"], summary="Отправленные рассылки")
async def broadcasts(session: AsyncSession = Depends(get_session)):
    """Отправленные рассылки и сколько получателей их прочитали."""
    return await notifications.broadcasts(session)


@router.get("/broadcasts/options", tags=["notifications"], summary="Варианты аудитории рассылки")
async def broadcast_options(session: AsyncSession = Depends(get_session)):
    """Должности, депо и бригады для построения среза сотрудников."""
    return await notifications.audience_options(session)


@router.post("/broadcasts/preview", tags=["notifications"], summary="Предпросмотр аудитории рассылки")
async def broadcast_preview(body: AudienceIn, session: AsyncSession = Depends(get_session)):
    return await notifications.preview(session, body.model_dump())


@router.post("/broadcasts", tags=["notifications"], summary="Отправить массовую рассылку")
async def send_broadcast(body: BroadcastIn, user: User = Depends(staff_user), session: AsyncSession = Depends(get_session)):
    return await notifications.send_broadcast(session, user, body.model_dump())


@router.post("/assistant", summary="ИИ-ассистент по кадровым данным")
async def assistant(
    body: AssistantIn,
    session: AsyncSession = Depends(get_session),
    cache: Cache = Depends(get_cache),
    ml: MLGateway = Depends(get_ml),
):
    """Запрос вида «проводники, у кого упал рейтинг безопасности за месяц». Для интеграции HR/LMS."""
    return await admin.assistant(session, cache, ml, body.message)


@router.get("/reports/training", tags=["reports"], summary="Отчёт о прогрессе обучения (JSON)")
async def training_report(days: int = ReportDays, session: AsyncSession = Depends(get_session)):
    """Отчёт по команде, компетенциям и частым ошибкам — для HR-систем и LMS."""
    return await reports.training_report(session, days)


@router.get(
    "/reports/training.xlsx",
    tags=["reports"],
    summary="Отчёт о прогрессе обучения (Excel)",
    response_class=Response,
    responses={200: {"content": {XLSX: {}}, "description": "Excel: сводка, сотрудники, компетенции, частые ошибки"}},
)
async def training_report_file(days: int = ReportDays, session: AsyncSession = Depends(get_session)):
    report = await reports.training_report(session, days)
    filename = f"m400-training-{report['generated_at'].astimezone(MSK):%Y-%m-%d}-{days}d.xlsx"
    return Response(
        training_report_xlsx(report),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
