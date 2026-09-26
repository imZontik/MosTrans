from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class RegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    position: str = "conductor"
    team: str = Field(default="", max_length=255)
    depot: str = Field(default="", max_length=255)


class StartRunIn(BaseModel):
    scenario_id: int
    restart: bool = False


class AnswerIn(BaseModel):
    node_id: str
    action: Literal["continue", "choose", "answer", "timeout"]
    choice_id: str | None = None
    text: str | None = Field(default=None, max_length=2000)


class TournamentAnswerIn(BaseModel):
    index: int = Field(ge=0)
    option: int | None = Field(default=None, ge=0, le=9)


class ScenarioIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = ""
    category: str
    position: str = "conductor"
    kind: Literal["training", "emergency"] = "training"
    difficulty: int = Field(default=1, ge=1, le=3)
    cover: str = Field(default="🚄", max_length=16)
    estimated_minutes: int = Field(default=5, ge=1, le=60)
    graph: dict
    is_published: bool = False


class ScenarioPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = None
    category: str | None = None
    position: str | None = None
    kind: Literal["training", "emergency"] | None = None
    difficulty: int | None = Field(default=None, ge=1, le=3)
    cover: str | None = Field(default=None, max_length=16)
    estimated_minutes: int | None = Field(default=None, ge=1, le=60)
    graph: dict | None = None
    is_published: bool | None = None


class GraphIn(BaseModel):
    graph: dict


class GenerateIn(BaseModel):
    spec: str = Field(min_length=10, max_length=6000)
    category: str = "conflict"
    position: str = "conductor"
    difficulty: int = Field(default=2, ge=1, le=3)


class EmployeePatch(BaseModel):
    position: str | None = None
    role: str | None = None
    team: str | None = None
    depot: str | None = None


class TournamentCreateIn(BaseModel):
    title: str | None = None
    starts_at: datetime
    duration_min: int = Field(default=30, ge=5, le=24 * 60)


class StartNowIn(BaseModel):
    duration_min: int = Field(default=30, ge=5, le=24 * 60)


class DispatchIn(BaseModel):
    scenario_id: int
    user_ids: list[int] | None = None
    message: str | None = Field(default=None, max_length=500)


class AssistantIn(BaseModel):
    message: str = Field(min_length=2, max_length=1000)
