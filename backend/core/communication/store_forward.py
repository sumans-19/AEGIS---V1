import logging
from typing import List
import heapq
from core.communication.models import NetworkMessage, MessagePriority

logger = logging.getLogger("store_forward")


class StoreAndForwardQueue:
    def __init__(self, max_messages: int = 1000):
        self.max_messages = max_messages
        # Elements in queue: (-priority, created_timestamp, sequence, message)
        # Using negative priority so EMERGENCY (1) -> -1 comes before LOW (5) -> -5
        # Wait, EMERGENCY (1) should pop FIRST.
        # In python heapq, smallest tuple pops first.
        # If we use `(priority.value, created_timestamp, seq, message)`,
        # EMERGENCY (1) is < LOW (5), so 1 pops before 5! That's correct.
        self._queue = []
        self._seq = 0

        self.metrics = {
            "queued_messages": 0,
            "dropped_messages": 0,
            "expired_messages": 0,
            "successfully_forwarded": 0,
        }

    def enqueue(self, message: NetworkMessage):
        self._purge_expired()

        if len(self._queue) >= self.max_messages:
            # Need to drop something. Try to drop a lower priority message.
            # We want to drop the message with the HIGHEST priority value (e.g. 5 = LOW)
            # Find the message with the highest priority value (lowest importance)
            max_prio_idx = -1
            max_prio_val = -1
            for i, item in enumerate(self._queue):
                if item[0] > max_prio_val:
                    max_prio_val = item[0]
                    max_prio_idx = i

            if max_prio_val > message.priority.value:
                # We can replace a lower importance message
                dropped = self._queue.pop(max_prio_idx)
                heapq.heapify(self._queue)  # Re-heapify after arbitrary removal
                self.metrics["dropped_messages"] += 1
                logger.warning(
                    f"StoreAndForward: Dropped lower priority message {dropped[3].message_id}"
                )
            elif (
                max_prio_val == message.priority.value
                and message.priority.value >= MessagePriority.NORMAL.value
            ):
                # Same priority, but low/normal. Replace the oldest one?
                # Actually just drop the new one.
                self.metrics["dropped_messages"] += 1
                logger.warning(
                    f"StoreAndForward: Queue full. Dropped incoming message {message.message_id}"
                )
                return
            else:
                # It's an EMERGENCY/CRITICAL queue and it's full. We must drop the oldest of the same priority.
                # Actually finding max_prio_idx works.
                dropped = self._queue.pop(max_prio_idx)
                heapq.heapify(self._queue)
                self.metrics["dropped_messages"] += 1
                logger.warning(
                    f"StoreAndForward: Queue full. Dropped message {dropped[3].message_id}"
                )

        self._seq += 1
        heapq.heappush(
            self._queue,
            (message.priority.value, message.created_timestamp, self._seq, message),
        )
        self.metrics["queued_messages"] = len(self._queue)

    def dequeue_all(self) -> List[NetworkMessage]:
        self._purge_expired()
        messages = []
        while self._queue:
            item = heapq.heappop(self._queue)
            messages.append(item[3])

        self.metrics["queued_messages"] = len(self._queue)
        return messages

    def _purge_expired(self):
        new_queue = []
        for item in self._queue:
            msg = item[3]
            if msg.is_expired:
                self.metrics["expired_messages"] += 1
                logger.debug(
                    f"StoreAndForward: Message {msg.message_id} expired in queue"
                )
            else:
                new_queue.append(item)

        if len(new_queue) != len(self._queue):
            heapq.heapify(new_queue)
            self._queue = new_queue
            self.metrics["queued_messages"] = len(self._queue)

    def record_forwarded(self):
        self.metrics["successfully_forwarded"] += 1
