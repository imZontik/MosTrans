"""Valkey repositories: live leaderboards, caches, emergency dispatch queue, rate limits.

PostgreSQL stays the source of truth; everything here can be rebuilt.
"""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis


class Cache:
    def __init__(self, client: redis.Redis):
        self.r = client

    async def get_json(self, key: str) -> Any | None:
        raw = await self.r.get(key)
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: Any, ttl: int) -> None:
        await self.r.set(key, json.dumps(value, default=str, ensure_ascii=False), ex=ttl)

    async def delete_prefix(self, prefix: str) -> None:
        async for key in self.r.scan_iter(match=f"{prefix}*"):
            await self.r.delete(key)


class TournamentBoard:
    """Live tournament leaderboard as a sorted set."""

    def __init__(self, client: redis.Redis):
        self.r = client

    @staticmethod
    def _key(tournament_id: int) -> str:
        return f"tournament:{tournament_id}:board"

    async def set_score(self, tournament_id: int, user_id: int, score: int) -> None:
        await self.r.zadd(self._key(tournament_id), {str(user_id): score})
        await self.r.expire(self._key(tournament_id), 60 * 60 * 24 * 14)

    async def top(self, tournament_id: int, limit: int) -> list[tuple[int, int]]:
        rows = await self.r.zrevrange(self._key(tournament_id), 0, limit - 1, withscores=True)
        return [(int(uid), int(score)) for uid, score in rows]

    async def rank(self, tournament_id: int, user_id: int) -> int | None:
        rank = await self.r.zrevrank(self._key(tournament_id), str(user_id))
        return None if rank is None else rank + 1

    async def size(self, tournament_id: int) -> int:
        return await self.r.zcard(self._key(tournament_id))

    async def exists(self, tournament_id: int) -> bool:
        return bool(await self.r.exists(self._key(tournament_id)))


class EmergencyQueue:
    """Emergencies dispatched by a lead, and cooldown for random ones."""

    def __init__(self, client: redis.Redis):
        self.r = client

    async def push(self, user_id: int, payload: dict) -> None:
        key = f"emergency:pending:{user_id}"
        await self.r.rpush(key, json.dumps(payload, ensure_ascii=False))
        await self.r.expire(key, 60 * 60 * 24)

    async def pop(self, user_id: int) -> dict | None:
        raw = await self.r.lpop(f"emergency:pending:{user_id}")
        return json.loads(raw) if raw else None

    async def next_random_at(self, user_id: int) -> float | None:
        raw = await self.r.get(f"emergency:next:{user_id}")
        return float(raw) if raw else None

    async def schedule_random(self, user_id: int, at: float) -> None:
        await self.r.set(f"emergency:next:{user_id}", str(at), ex=60 * 60 * 24)


class RateLimiter:
    def __init__(self, client: redis.Redis):
        self.r = client

    async def hit(self, key: str, limit: int, window_sec: int) -> bool:
        """Register a hit; False when the limit is exceeded."""
        full = f"ratelimit:{key}"
        count = await self.r.incr(full)
        if count == 1:
            await self.r.expire(full, window_sec)
        return count <= limit
