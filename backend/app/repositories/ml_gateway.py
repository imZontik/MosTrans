"""Gateway to the ML service (answer grading, scenario drafts, instructor assistant)."""

from __future__ import annotations

import json
import logging
import re

import httpx

from app.frameworks.config import get_settings
from app.frameworks.metrics import ML_CALLS
from app.business.engine import Grade

log = logging.getLogger(__name__)


class MLGateway:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.ml_service_url.rstrip("/")
        self.timeout = settings.ml_timeout_sec

    async def _post(self, path: str, payload: dict, operation: str, timeout: float | None = None) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=timeout or self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}{path}",
                    content=json.dumps(payload, default=str, ensure_ascii=False).encode(),
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                ML_CALLS.labels(operation=operation, status="ok").inc()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            ML_CALLS.labels(operation=operation, status="error").inc()
            log.warning("ML service %s failed: %s", path, exc)
            return None

    async def grade(self, *, situation: str, rubric: str, ideal: str, keywords: list[str], answer: str, lang: str) -> Grade:
        data = await self._post(
            "/v1/grade",
            {"situation": situation, "rubric": rubric, "ideal": ideal, "keywords": keywords, "answer": answer, "lang": lang},
            "grade",
        )
        if data is None:
            return _offline_grade(answer, keywords)
        return Grade(
            score=float(data.get("score", 0)),
            feedback=data.get("feedback", ""),
            verdict=data.get("verdict", ""),
            provider=data.get("provider", "ml"),
        )

    async def generate_scenario(self, payload: dict) -> dict | None:
        return await self._post("/v1/scenarios/generate", payload, "generate", get_settings().ml_generate_timeout_sec)

    async def assistant(self, payload: dict) -> dict | None:
        return await self._post("/v1/assistant", payload, "assistant")


def _offline_grade(answer: str, keywords: list[str]) -> Grade:
    """Last-resort grading when the ML service is unreachable."""
    text = answer.lower()
    hits = sum(1 for k in keywords if re.search(re.escape(k.lower()), text))
    share = hits / len(keywords) if keywords else 0.5
    score = round(min(10.0, 3 + 7 * share), 1)
    return Grade(
        score=score,
        feedback="ИИ-оценщик временно недоступен — ответ оценён по ключевым пунктам регламента.",
        verdict="offline",
        provider="offline",
    )
