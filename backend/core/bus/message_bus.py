from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Dict, List
from core.bus.message import Message
import asyncio

# Callback type definition: async function taking a Message
MessageHandler = Callable[[Message], Awaitable[None]]


class MessageBus(ABC):
    """
    Abstract interface for the AEGIS inter-module message bus.
    Allows for transport-independent pub/sub messaging.
    """

    @abstractmethod
    async def publish(self, topic: str, message: Message) -> None:
        """Publish a message to a specific topic."""

    @abstractmethod
    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        """Subscribe to a topic with a callback handler."""


class InMemoryAsyncMessageBus(MessageBus):
    """
    In-memory async implementation of the MessageBus using asyncio.Queue.
    Ideal for simulation and single-node deployment before transitioning to ROS 2/DDS.
    """

    def __init__(self):
        self._subscribers: Dict[str, List[MessageHandler]] = {}
        self._queue: asyncio.Queue = asyncio.Queue()
        self._task = None

    def start(self):
        """Starts the background task to process the message queue."""
        if self._task is None:
            self._task = asyncio.create_task(self._process_queue())

    def stop(self):
        """Stops the background task."""
        if self._task is not None:
            self._task.cancel()
            self._task = None

    async def _process_queue(self):
        """Continuously pulls messages from the queue and dispatches them."""
        try:
            while True:
                topic, message = await self._queue.get()
                handlers = self._subscribers.get(topic, [])

                # Dispatch concurrently to all handlers
                tasks = [handler(message) for handler in handlers]
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

                self._queue.task_done()
        except asyncio.CancelledError:
            pass

    async def publish(self, topic: str, message: Message) -> None:
        """Adds a message to the internal asyncio queue."""
        await self._queue.put((topic, message))

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        """Registers a handler for a topic."""
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)
