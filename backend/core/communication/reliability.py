import asyncio
import logging
from typing import Dict, Any, Callable
from core.communication.models import NetworkMessage

logger = logging.getLogger("reliability")


class AckTracker:
    def __init__(self, max_retries: int = 3, ack_timeout: float = 2.0):
        self.max_retries = max_retries
        self.ack_timeout = ack_timeout
        # message_id -> {"message": msg, "retries": int, "task": asyncio.Task, "on_failure": callable}
        self.pending_acks: Dict[str, Dict[str, Any]] = {}

    def track(
        self,
        message: NetworkMessage,
        resend_callback: Callable[[NetworkMessage], None],
        failure_callback: Callable[[NetworkMessage], None],
    ):
        if message.message_id in self.pending_acks:
            return

        task = asyncio.create_task(
            self._ack_loop(message, resend_callback, failure_callback)
        )
        self.pending_acks[message.message_id] = {
            "message": message,
            "retries": 0,
            "task": task,
            "failure_callback": failure_callback,
        }

    def receive_ack(self, message_id: str):
        if message_id in self.pending_acks:
            entry = self.pending_acks.pop(message_id)
            entry["task"].cancel()
            logger.debug(f"AckTracker: Received ACK for {message_id}")

    async def _ack_loop(
        self,
        message: NetworkMessage,
        resend_callback: Callable[[NetworkMessage], None],
        failure_callback: Callable[[NetworkMessage], None],
    ):
        try:
            while True:
                await asyncio.sleep(self.ack_timeout)

                if message.message_id not in self.pending_acks:
                    break

                entry = self.pending_acks[message.message_id]
                entry["retries"] += 1

                if entry["retries"] > self.max_retries:
                    logger.warning(
                        f"AckTracker: Max retries exceeded for {message.message_id}"
                    )
                    self.pending_acks.pop(message.message_id, None)
                    failure_callback(message)
                    break

                logger.debug(
                    f"AckTracker: Retrying {message.message_id} (Attempt {entry['retries']})"
                )
                resend_callback(message)

        except asyncio.CancelledError:
            pass
