import pytest
import asyncio
from unittest.mock import MagicMock

from core.communication.models import NetworkMessage, MessagePriority, LinkState
from core.communication.mesh_router import MeshRouter
from core.communication.store_forward import StoreAndForwardQueue
from core.communication.reliability import AckTracker


def test_serialization_and_ttl():
    msg = NetworkMessage(
        source_id="d1",
        destination_id="d2",
        message_type="TEST",
        payload={"a": 1},
        ttl=1.0,
    )
    assert msg.is_expired is False


def test_store_and_forward_priority():
    q = StoreAndForwardQueue(max_messages=2)
    # Queue is full of normal messages
    q.enqueue(
        NetworkMessage(
            source_id="d1",
            destination_id="d2",
            message_type="T1",
            payload={},
            priority=MessagePriority.NORMAL,
        )
    )
    q.enqueue(
        NetworkMessage(
            source_id="d1",
            destination_id="d2",
            message_type="T2",
            payload={},
            priority=MessagePriority.NORMAL,
        )
    )

    assert q.metrics["queued_messages"] == 2

    # Emergency message comes in
    emerg = NetworkMessage(
        source_id="d1",
        destination_id="d2",
        message_type="EMERG",
        payload={},
        priority=MessagePriority.EMERGENCY,
    )
    q.enqueue(emerg)

    assert q.metrics["queued_messages"] == 2
    assert q.metrics["dropped_messages"] == 1

    messages = q.dequeue_all()
    assert len(messages) == 2
    assert messages[0].message_type == "EMERG"


def test_mesh_router_dijkstra():
    router = MeshRouter("d1")

    # Path A: d1 -> d2 -> d3 (loss 0.5)
    router.update_link_state(
        "d1",
        LinkState(
            source_id="d1",
            destination_id="d2",
            link_quality=100.0,
            latency=0.01,
            packet_loss=0.0,
        ),
    )
    router.update_link_state(
        "d2",
        LinkState(
            source_id="d2",
            destination_id="d3",
            link_quality=100.0,
            latency=0.01,
            packet_loss=0.5,
        ),
    )

    # Path B: d1 -> d4 -> d5 -> d3 (loss 0.0)
    router.update_link_state(
        "d1",
        LinkState(
            source_id="d1",
            destination_id="d4",
            link_quality=100.0,
            latency=0.01,
            packet_loss=0.0,
        ),
    )
    router.update_link_state(
        "d4",
        LinkState(
            source_id="d4",
            destination_id="d5",
            link_quality=100.0,
            latency=0.01,
            packet_loss=0.0,
        ),
    )
    router.update_link_state(
        "d5",
        LinkState(
            source_id="d5",
            destination_id="d3",
            link_quality=100.0,
            latency=0.01,
            packet_loss=0.0,
        ),
    )

    next_hop = router.get_next_hop("d3")
    # Path B should be preferred despite being longer, because packet loss on path A adds huge penalty
    assert next_hop == "d4"


@pytest.mark.asyncio
async def test_ack_tracker_timeout():
    tracker = AckTracker(max_retries=1, ack_timeout=0.1)
    msg = NetworkMessage(
        source_id="d1",
        destination_id="d2",
        message_type="TEST",
        payload={},
        requires_ack=True,
    )

    resend_mock = MagicMock()
    fail_mock = MagicMock()

    tracker.track(msg, resend_mock, fail_mock)

    await asyncio.sleep(0.3)

    assert resend_mock.call_count == 1
    assert fail_mock.call_count == 1


@pytest.mark.asyncio
async def test_ack_tracker_success():
    tracker = AckTracker(max_retries=1, ack_timeout=0.2)
    msg = NetworkMessage(
        source_id="d1",
        destination_id="d2",
        message_type="TEST",
        payload={},
        requires_ack=True,
    )

    resend_mock = MagicMock()
    fail_mock = MagicMock()

    tracker.track(msg, resend_mock, fail_mock)
    tracker.receive_ack(msg.message_id)

    await asyncio.sleep(0.3)

    assert resend_mock.call_count == 0
    assert fail_mock.call_count == 0
