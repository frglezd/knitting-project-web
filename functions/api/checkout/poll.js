// POST /api/checkout/poll — polling fallback for Stripe webhook delivery.
// Stripe's real-time webhook delivery to this account is currently broken
// (see assets/proposals/todo/stripe-support-ticket-webhook-not-delivering.md,
// gitignored) — events are created correctly but never delivered to our
// registered endpoint. This endpoint is called on a schedule by a separate
// tiny Cloudflare Worker (poller/, its own Workers project — Pages
// Functions have no Cron Trigger support) that has no admin session
// cookie, so it's protected by a shared secret header instead of
// requireAuth — NOT an admin-browser-facing endpoint.
//
// Queries Stripe's Events API directly for recent checkout.session.completed
// events and runs the exact same confirmPaidOrder(...) the real webhook
// uses (../_checkout.js) for each one. Reprocessing an already-confirmed
// order is a safe no-op — confirmPaidOrder's own idempotency guard (the
// `UPDATE orders SET status='paid' WHERE status='pending_payment'` flip)
// handles that, same as Stripe's own webhook redelivery already relies on.
// This is why no "last polled" cursor is tracked anywhere: a ~20 minute
// lookback on a 5-minute schedule gives comfortable overlap for free.

import { confirmPaidOrder } from "../_checkout.js";

const LOOKBACK_SECONDS = 20 * 60;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  const provided = request.headers.get("X-Poll-Secret");
  if (!env.POLL_SECRET || !provided || provided !== env.POLL_SECRET) {
    return json({ error: "No autorizado" }, 401);
  }

  const createdGte = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;

  const params = new URLSearchParams();
  params.set("type", "checkout.session.completed");
  params.set("created[gte]", String(createdGte));
  params.set("limit", "100");

  let stripeRes;
  try {
    stripeRes = await fetch(`https://api.stripe.com/v1/events?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
    });
  } catch (err) {
    console.error("Fallo la llamada a Stripe Events API (poll):", err);
    return json({ error: "No se pudo consultar Stripe" }, 502);
  }

  if (!stripeRes.ok) {
    const detail = await stripeRes.text().catch(() => "");
    console.error("Stripe Events API respondio " + stripeRes.status + " (poll):", detail);
    return json({ error: "No se pudo consultar Stripe" }, 502);
  }

  const body = await stripeRes.json();
  const events = Array.isArray(body.data) ? body.data : [];

  const confirmed = [];
  const errors = [];

  for (const event of events) {
    const session = event && event.data && event.data.object;
    if (!session || session.payment_status !== "paid") continue;

    const orderId = Number(session.metadata && session.metadata.order_id);
    if (!Number.isInteger(orderId) || orderId <= 0) continue;

    try {
      const result = await confirmPaidOrder(env, { orderId });
      if (result.status === "paid" || result.status === "paid_oversold") {
        confirmed.push(orderId);
      }
    } catch (err) {
      console.error("confirmPaidOrder fallo durante poll (orderId=" + orderId + "):", err);
      errors.push({ orderId, error: String((err && err.message) || err) });
    }
  }

  return json({ checked: events.length, confirmed, errors });
}
