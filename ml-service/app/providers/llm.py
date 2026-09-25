"""LLM providers available in Russia: GigaChat (API) and Qwen via Ollama (local inference)."""

from __future__ import annotations

import json
import re
import time
import uuid
from functools import lru_cache

import httpx
import json_repair

from app.config import get_settings


class LLMError(RuntimeError):
    pass


def extract_json(text: str) -> dict:
    """LLMs sometimes wrap JSON in prose or code fences — take the first object."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("В ответе модели нет JSON")
    raw = text[start : end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        # Long graphs often come with an unclosed array or a stray brace — repair them
        repaired = json_repair.loads(raw)
        if not isinstance(repaired, dict) or not repaired:
            raise LLMError(f"Некорректный JSON от модели: {exc}") from exc
        return repaired


class LLMProvider:
    name = "llm"

    async def complete(self, system: str, user: str, temperature: float = 0.2, heavy: bool = False) -> str:
        raise NotImplementedError

    async def complete_json(self, system: str, user: str, temperature: float = 0.2, heavy: bool = False) -> dict:
        """``heavy`` — long structured output (scenario drafts): a stronger model and a longer timeout."""
        return extract_json(await self.complete(system, user, temperature, heavy))


class GigaChatProvider(LLMProvider):
    name = "gigachat"

    def __init__(self) -> None:
        self.s = get_settings()
        self._token: str | None = None
        self._expires_at = 0.0

    async def _access_token(self, client: httpx.AsyncClient) -> str:
        if self._token and time.time() < self._expires_at - 60:
            return self._token
        if not self.s.gigachat_auth_key:
            raise LLMError("GIGACHAT_AUTH_KEY не задан")
        response = await client.post(
            self.s.gigachat_oauth_url,
            headers={
                "Authorization": f"Basic {self.s.gigachat_auth_key}",
                "RqUID": str(uuid.uuid4()),
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            data={"scope": self.s.gigachat_scope},
        )
        response.raise_for_status()
        data = response.json()
        self._token = data["access_token"]
        self._expires_at = data.get("expires_at", 0) / 1000 or time.time() + 1500
        return self._token

    async def complete(self, system: str, user: str, temperature: float = 0.2, heavy: bool = False) -> str:
        timeout = self.s.llm_heavy_timeout_sec if heavy else self.s.llm_timeout_sec
        try:
            async with httpx.AsyncClient(timeout=timeout, verify=self.s.gigachat_verify_ssl) as client:
                token = await self._access_token(client)
                response = await client.post(
                    f"{self.s.gigachat_api_url}/chat/completions",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                    json={
                        "model": (heavy and self.s.gigachat_heavy_model) or self.s.gigachat_model,
                        "temperature": temperature,
                        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    },
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as exc:
            raise LLMError(f"GigaChat: {exc!r}") from exc


class OllamaProvider(LLMProvider):
    """Local open-source model (Qwen 2.5) — no data leaves the company perimeter."""

    name = "ollama-qwen"

    def __init__(self) -> None:
        self.s = get_settings()

    async def complete(self, system: str, user: str, temperature: float = 0.2, heavy: bool = False) -> str:
        timeout = self.s.llm_heavy_timeout_sec if heavy else self.s.llm_timeout_sec
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.s.ollama_url}/api/chat",
                    json={
                        "model": self.s.ollama_model,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": temperature},
                        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    },
                )
                response.raise_for_status()
                return response.json()["message"]["content"]
        except (httpx.HTTPError, KeyError) as exc:
            raise LLMError(f"Ollama: {exc}") from exc


@lru_cache
def get_llm() -> LLMProvider | None:
    """One provider per process, so the GigaChat access token (30 min) is reused."""
    provider = get_settings().ml_provider.lower()
    if provider == "gigachat":
        return GigaChatProvider()
    if provider in ("ollama", "qwen"):
        return OllamaProvider()
    return None
