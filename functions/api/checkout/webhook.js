// POST /api/checkout/webhook — public endpoint, authenticated via Stripe's
// own request-signing scheme (Stripe-Signature header), not requireAuth —
// Stripe's servers carry no admin session cookie. Always returns 200 once
// the signature is valid, even for event types this phase doesn't act on:
// Stripe retries aggressively (up to 3 days) on any non-2xx response.
//
// The actual status-flip/stock-decrement/email logic lives in
// confirmPaidOrder (../_checkout.js), shared with checkout/poll.js's
// polling fallback — this file is just event-type filtering + extracting
// the order id, per the plan doc's split.

import { verifyStripeSignature } from "../_payments.js";
import { confirmPaidOrder } from "../_checkout.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  // Signature verification needs the exact raw bytes — read as text first,
  // never request.json() (that would consume the stream before we can
  // verify it, and risks re-serializing differently than what Stripe signed).
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(request, rawBody, env);
  if (!valid) {
    return json({ error: "Firma invalida" }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "JSON invalido" }, 400);
  }

  const session = event && event.data && event.data.object;
  if (event.type !== "checkout.session.completed" || !session || session.payment_status !== "paid") {
    // Card payments confirm synchronously via this event; OXXO/other async
    // methods are out of scope for this phase (see the plan's Section 1) —
    // no-op rather than error so Stripe doesn't retry it forever.
    return json({ ok: true, ignored: true });
  }

  const orderId = Number(session.metadata && session.metadata.order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return json({ ok: true, ignored: true });
  }

  const result = await confirmPaidOrder(env, { orderId });
  return json({ ok: true, ...result });
}
