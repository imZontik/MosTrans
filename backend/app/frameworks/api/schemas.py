from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255, description="E-mail проводника", example="ivan@m400.ru")
    password: str = Field(min_length=1, max_length=128, description="Пароль", example="secret")


class RegisterIn(BaseModel):
    email: str = Field(
        min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="E-mail проводника", example="ivan@m400.ru"
    )
    password: str = Field(min_length=6, max_length=128, description="Пароль (минимум 6 символов)", example="secret")
    full_name: str = Field(min_length=2, max_length=255, description="ФИО", example="Иван Петров")
    position: str = Field(default="conductor", description="Должность", example="conductor")
    team: str = Field(default="", max_length=255, description="Бригада", example="Бригада 3")
    depot: str = Field(default="", max_length=255, description="Депо", example="Депо Москва")


class NameDisplayIn(BaseModel):
    name_display: Literal["short", "full"] = Field(
        description="Как коллеги видят имя в рейтинге, турнирах и профиле: short — «Иван С.», full — «Иван Смирнов»",
        example="short",
    )


class StartRunIn(BaseModel):
    scenario_id: int = Field(description="ID сценария", example=1)
    restart: bool = Field(default=False, description="Перезапустить прохождение, если есть незавершённое")


class AnswerIn(BaseModel):
    node_id: str = Field(description="ID узла графа, на который отвечаем", example="n3")
    action: Literal["continue", "choose", "answer", "timeout"] = Field(description="Тип ответа")
    choice_id: str | None = Field(default=None, description="Выбранный вариант — для action=choose", example="a")
    text: str | None = Field(default=None, max_length=2000, description="Свободный текст — для action=answer", example="вызвать скорую")


class TournamentAnswerIn(BaseModel):
    index: int = Field(ge=0, description="Номер вопроса в турнире", example=0)
    option: int | None = Field(default=None, ge=0, le=9, description="Номер выбранного варианта", example=2)


class ScenarioIn(BaseModel):
    title: str = Field(min_length=3, max_length=255, description="Название сценария", example="Пассажир занял чужое место")
    description: str = Field(default="", description="Описание сценария")
    category: str = Field(description="Категория (например, конфликтная ситуация)", example="conflict")
    position: str = Field(default="conductor", description="Должность, для которой предназначен сценарий")
    kind: Literal["training", "emergency"] = Field(default="training", description="Тип: обучение или экстренный случай")
    difficulty: int = Field(default=1, ge=1, le=3, description="Сложность 1–3", example=2)
    cover: str = Field(default="🚄", max_length=16, description="Эмодзи-обложка")
    estimated_minutes: int = Field(default=5, ge=1, le=60, description="Оценка длительности в минутах")
    graph: dict = Field(description="JSON-граф сценария (узлы, переходы, шкалы)")
    is_published: bool = Field(default=False, description="Опубликован ли сценарий")


class ScenarioPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255, description="Название сценария")
    description: str | None = Field(default=None, description="Описание сценария")
    category: str | None = Field(default=None, description="Категория")
    position: str | None = Field(default=None, description="Должность")
    kind: Literal["training", "emergency"] | None = Field(default=None, description="Тип сценария")
    difficulty: int | None = Field(default=None, ge=1, le=3, description="Сложность 1–3")
    cover: str | None = Field(default=None, max_length=16, description="Эмодзи-обложка")
    estimated_minutes: int | None = Field(default=None, ge=1, le=60, description="Оценка длительности в минутах")
    graph: dict | None = Field(default=None, description="JSON-граф сценария")
    is_published: bool | None = Field(default=None, description="Опубликован ли сценарий")


class GraphIn(BaseModel):
    graph: dict = Field(description="JSON-граф сценария для проверки")


class GenerateIn(BaseModel):
    spec: str = Field(min_length=10, max_length=6000, description="ТЗ для генерации сценария")
    category: str = Field(default="conflict", description="Категория сценария")
    position: str = Field(default="conductor", description="Должность")
    difficulty: int = Field(default=2, ge=1, le=3, description="Сложность 1–3")


class EmployeePatch(BaseModel):
    position: str | None = Field(default=None, description="Должность")
    role: str | None = Field(default=None, description="Роль: employee / lead / admin")
    team: str | None = Field(default=None, description="Бригада")
    depot: str | None = Field(default=None, description="Депо")


class TournamentCreateIn(BaseModel):
    title: str | None = Field(default=None, description="Название турнира", example="Недельный турнир")
    starts_at: datetime = Field(description="Время начала в часовом поясе МСК")
    duration_min: int = Field(default=30, ge=5, le=24 * 60, description="Длительность в минутах")


class StartNowIn(BaseModel):
    duration_min: int = Field(default=30, ge=5, le=24 * 60, description="Длительность в минутах")


class DispatchIn(BaseModel):
    scenario_id: int = Field(description="ID сценария спецсобытия", example=3)
    user_ids: list[int] | None = Field(default=None, description="Получатели; пусто — всем")
    message: str | None = Field(default=None, max_length=500, description="Сопроводительное сообщение")


class AssistantIn(BaseModel):
    message: str = Field(min_length=2, max_length=1000, description="Запрос на естественном языке по кадровым данным")


Priority = Literal["high", "normal", "low"]


class ReadManyIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200, description="Уведомления, которые сотрудник увидел на экране")


class ReadAllIn(BaseModel):
    priority: Priority | None = Field(default=None, description="Отметить прочитанными только уведомления этого приоритета")


class AudienceIn(BaseModel):
    """Кому достанется рассылка: всем, срезу сотрудников (поля объединяются по «И») или выбранным людям."""

    mode: Literal["all", "segment", "users"] = Field(default="all", description="Режим аудитории: все / срез / конкретные люди")
    positions: list[str] = Field(default_factory=list, max_length=10, description="Должности")
    depots: list[str] = Field(default_factory=list, max_length=100, description="Депо")
    teams: list[str] = Field(default_factory=list, max_length=200, description="Бригады")
    inactive_days: int | None = Field(default=None, ge=1, le=365, description="Неактивные N дней")
    user_ids: list[int] = Field(default_factory=list, max_length=1000, description="Конкретные сотрудники")


class BroadcastIn(BaseModel):
    title: str = Field(min_length=2, max_length=120, description="Заголовок рассылки")
    body: str = Field(default="", max_length=2000, description="Текст рассылки")
    priority: Priority = Field(default="normal", description="Приоритет: high / normal / low")
    link: str = Field(default="", max_length=255, description="Ссылка")
    audience: AudienceIn = Field(default_factory=AudienceIn, description="Аудитория рассылки")
