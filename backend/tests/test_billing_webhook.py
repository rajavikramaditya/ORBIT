"""Razorpay webhook parsing.

This covers a money path, so it is tested at the level where it can be tested
without a database or a live Razorpay signature: `parse_payment_webhook` turns a
webhook body into the decision the route acts on.

The bug these lock in: the route used to pull `order_id` out of any payment
event and mark the invoice paid. `payment.failed` carries the same order_id in
the same envelope, so a declined card produced a PAID invoice.
"""
from routes_billing import parse_payment_webhook


def _body(event, entity=None):
    return {"event": event, "payload": {"payment": {"entity": entity or {}}}}


CAPTURED = _body("payment.captured", {
    "id": "pay_ABC123",
    "order_id": "order_XYZ789",
    "amount": 118000,
    "method": "upi",
    "status": "captured",
})


def test_captured_payment_is_a_capture():
    parsed = parse_payment_webhook(CAPTURED)
    assert parsed["is_capture"] is True
    assert parsed["order_id"] == "order_XYZ789"
    assert parsed["payment_id"] == "pay_ABC123"
    assert parsed["amount"] == 118000
    assert parsed["method"] == "upi"


def test_failed_payment_is_not_a_capture():
    """The regression that mattered: same order_id, must NOT mark paid."""
    parsed = parse_payment_webhook(_body("payment.failed", {
        "id": "pay_DEF456",
        "order_id": "order_XYZ789",
        "error_reason": "payment_failed",
    }))
    assert parsed["is_capture"] is False
    assert parsed["order_id"] == "order_XYZ789"


def test_authorized_but_not_captured_is_not_a_capture():
    parsed = parse_payment_webhook(_body("payment.authorized", {"order_id": "order_XYZ789"}))
    assert parsed["is_capture"] is False


def test_unrelated_events_are_not_captures():
    for event in ("refund.created", "order.paid", "payment.dispute.created", "", None):
        parsed = parse_payment_webhook({"event": event, "payload": {}})
        assert parsed["is_capture"] is False, event


def test_malformed_bodies_do_not_raise():
    for body in ({}, {"payload": None}, {"payload": {"payment": None}},
                 {"event": "payment.captured"}, {"event": "payment.captured", "payload": {}}):
        parsed = parse_payment_webhook(body)
        assert parsed["order_id"] is None
        # A capture with no order id is still not actionable; the route checks both.
        assert parsed["payment_id"] is None


def test_capture_without_order_id_is_not_actionable():
    parsed = parse_payment_webhook(_body("payment.captured", {"id": "pay_NOORDER"}))
    assert parsed["is_capture"] is True
    assert parsed["order_id"] is None
