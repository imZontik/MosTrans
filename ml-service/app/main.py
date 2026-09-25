import logging

from fastapi import FastAPI
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

from app import assistant, generation, grading
from app.config import get_settings
from app.providers.llm import get_llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

GRADES = Counter("m400_ml_grades_total", "Graded answers", ["provider", "verdict"])
GRADE_SCORE = Histogram("m400_ml_grade_score", "Grades distribution", buckets=(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))
GENERATIONS = Counter("m400_ml_generations_total", "Generated scenario drafts", ["provider"])

app = FastAPI(title="Магистраль 400 — ML service", version="0.1.0")
Instrumentator(excluded_handlers=["/metrics", "/health"]).instrument(app).expose(app, include_in_schema=False)


class GradeIn(BaseModel):
    situation: str = ""
    rubric: str = ""
    ideal: str = ""
    keywords: list[str] = []
    answer: str = Field(min_length=1, max_length=2000)
    lang: str = "ru"


class GenerateIn(BaseModel):
    spec: str = Field(min_length=10, max_length=6000)
    category: str = "conflict"
    position: str = "conductor"
    difficulty: int = 2


class AssistantIn(BaseModel):
    message: str
    snapshot: dict = {}


@app.get("/health")
async def health():
    return {"status": "ok", "provider": get_settings().ml_provider}


@app.post("/v1/grade")
async def grade(body: GradeIn):
    result = await grading.grade(get_llm(), **body.model_dump())
    GRADES.labels(provider=result["provider"], verdict=result["verdict"]).inc()
    GRADE_SCORE.observe(result["score"])
    return result


@app.post("/v1/scenarios/generate")
async def generate(body: GenerateIn):
    result = await generation.generate(get_llm(), **body.model_dump())
    GENERATIONS.labels(provider=result["provider"]).inc()
    return result


@app.post("/v1/assistant")
async def ask(body: AssistantIn):
    return await assistant.answer(get_llm(), message=body.message, snapshot=body.snapshot)
