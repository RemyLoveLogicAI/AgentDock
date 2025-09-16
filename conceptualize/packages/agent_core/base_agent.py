from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Optional

from comm_protocol import Envelope

from .bus import RedisBus


class BaseAgent(ABC):
    """Shared scaffolding for all agents (Captain, Sergeant, Detective, …)."""

    def __init__(self, agent_id: str, bus: Optional[RedisBus] = None):
        self.agent_id = agent_id
        self.bus = bus or RedisBus()

    # ---------------------------------------------------------------------
    # Lifecycle helpers
    # ---------------------------------------------------------------------
    async def run_forever(self) -> None:
        print(f"[{self.agent_id}] starting event loop …")
        async for envelope in self.bus.subscribe():
            if self._should_handle(envelope):
                asyncio.create_task(self._safe_handle(envelope))

    def _should_handle(self, envelope: Envelope) -> bool:
        rcpt = envelope.recipient
        return rcpt == self.agent_id or rcpt == "broadcast" or (
            isinstance(rcpt, list) and self.agent_id in rcpt
        )

    async def _safe_handle(self, envelope: Envelope):
        try:
            await self.handle(envelope)
        except Exception as exc:  # pragma: no cover – robust background agent
            print(f"[{self.agent_id}] Error while handling message: {exc}")

    # ------------------------------------------------------------------
    # To be implemented by concrete subclasses
    # ------------------------------------------------------------------
    @abstractmethod
    async def handle(self, envelope: Envelope):
        """Process *envelope*.  Must be implemented by subclasses."""
        raise NotImplementedError