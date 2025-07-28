from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, Optional

import aioredis

from comm_protocol import Envelope


class RedisBus:
    """Lightweight abstraction around Redis Streams for pub/sub semantics."""

    def __init__(self, url: str = "redis://localhost:6379", stream_key: str = "conceptualize-bus"):
        self._url = url
        self._stream_key = stream_key
        self._redis: Optional[aioredis.Redis] = None

    async def _ensure_conn(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = await aioredis.from_url(self._url, decode_responses=True)
        return self._redis

    async def publish(self, envelope: Envelope) -> None:
        redis = await self._ensure_conn()
        await redis.xadd(self._stream_key, {"data": envelope.json()})

    async def subscribe(self, last_id: str = "$") -> AsyncIterator[Envelope]:
        """Yield envelopes as they arrive starting after *last_id* (defaults to new messages)."""
        redis = await self._ensure_conn()
        while True:
            streams = await redis.xread({self._stream_key: last_id}, block=0)
            for _stream, messages in streams:
                for message_id, data in messages:
                    last_id = message_id
                    raw = data.get("data")
                    if raw is None:
                        continue
                    try:
                        envelope = Envelope.parse_raw(raw)
                        yield envelope
                    except Exception as exc:  # pragma: no cover – log & continue
                        print(f"[RedisBus] Failed to parse envelope: {exc}")