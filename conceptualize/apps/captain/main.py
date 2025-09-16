import asyncio

from agent_core import BaseAgent, RedisBus
from comm_protocol import Envelope


class CaptainAgent(BaseAgent):
    """High-level orchestrator: for now it simply ACKs every message."""

    async def handle(self, envelope: Envelope):
        print(f"[Captain] Handling {envelope.kind} from {envelope.sender}")
        response = Envelope(
            sender=self.agent_id,
            recipient=envelope.sender,
            priority=envelope.priority,
            kind="response",
            content={
                "status": "ack",
                "echo": envelope.content,
            },
        )
        await self.bus.publish(response)


def main():
    bus = RedisBus()
    captain = CaptainAgent(agent_id="captain", bus=bus)
    asyncio.run(captain.run_forever())


if __name__ == "__main__":
    main()