// POST /api/checkout/webhook — public endpoint, authenticated via Stripe's
// own request-signing scheme (Stripe-Signature header), not requireAuth —
// Stripe's servers carry no admin session cookie. Always returns 200 once
// the signature is valid, even for event types this phase doesn't act on:
// Stripe retries aggressively (up to 3 days) on any non-2xx response.

import { verifyStripeSignature } from "../_payments.js";
import { sendOrderConfirmationEmails } from "../_email.js";

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

  const order = await env.DB.prepare(
    "SELECT id, created_at, customer_name, customer_email, customer_phone, total, currency FROM orders WHERE id = ?"
  )
    .bind(orderId)
    .first();
  if (!order) {
    return json({ ok: true, ignored: true });
  }

  // Idempotent status flip: Stripe can deliver the same event more than
  // once. meta.changes === 0 means a previous delivery already flipped this
  // order to 'paid' (or beyond) — skip the stock decrement, it already ran.
  const flip = await env.DB.prepare(
    "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_payment'"
  )
    .bind(orderId)
    .run();

  if (flip.meta.changes === 0) {
    return json({ ok: true, duplicate: true });
  }

  const { results: items } = await env.DB.prepare(
    `SELECT product_id, product_color_id, cantidad, product_nombre, color_nombre,
            unidad_precio, precio_unitario, subtotal
     FROM order_items WHERE order_id = ?`
  )
    .bind(orderId)
    .all();

  const decrementStatements = items.map((item) =>
    item.product_color_id
      ? env.DB.prepare("UPDATE product_colores SET stock = stock - ? WHERE id = ? AND stock >= ?").bind(
          item.cantidad,
          item.product_color_id,
          item.cantidad
        )
      : env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?").bind(
          item.cantidad,
          item.product_id,
          item.cantidad
        )
  );

  const decrementResults = decrementStatements.length > 0 ? await env.DB.batch(decrementStatements) : [];
  const oversold = decrementResults.some((r) => r.meta.changes === 0);

  if (oversold) {
    await env.DB.prepare("UPDATE orders SET status = 'paid_oversold' WHERE id = ?").bind(orderId).run();
  }

  try {
    await sendOrderConfirmationEmails(env, {
      order: { ...order, status: oversold ? "paid_oversold" : "paid" },
      items,
    });
  } catch (err) {
    console.error("No se pudieron enviar los correos de confirmación del pedido", orderId, err);
  }

  return json({ ok: true });
}
