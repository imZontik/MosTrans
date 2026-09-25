"""Valkey (Redis-compatible) client."""

import redis.asyncio as redis

from app.frameworks.config import get_settings

_client: redis.Redis | None = None


def get_valkey() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(get_settings().valkey_url, decode_responses=True)
    return _client


async def close_valkey() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
