// Shared order-confirmation logic, extracted from checkout/webhook.js so
// both the real-time webhook and the polling fallback (checkout/poll.js)
// call the exact same money-critical path instead of duplicating it.
// Underscore-prefixed like _auth.js/_payments.js/_lookup.js/_email.js so
// Pages' file-based router doesn't expose this as a route.

import { sendOrderConfirmationEmails } from "./_email.js";

// Idempotently confirms a paid order: flips status pending_payment -> paid,
// conditionally decrements stock per line item (product_colores if the item
// carries a product_color_id, else products), flags paid_oversold if any
// decrement's WHERE guard fails, and attempts confirmation emails.
//
// Safe to call more than once for the same orderId — the status-flip
// `UPDATE ... WHERE status = 'pending_payment'` is itself the idempotency
// check (Stripe's own webhook redelivery relies on this already; the
// polling fallback reprocessing the same event on overlapping windows
// relies on it too). Returns a small result object describing what
// happened, useful for the poll endpoint's summary response.
export async function confirmPaidOrder(env, { orderId }) {
  const order = await env.DB.prepare(
    "SELECT id, created_at, customer_name, customer_email, customer_phone, total, currency FROM orders WHERE id = ?"
  )
    .bind(orderId)
    .first();
  if (!order) {
    return { orderId, status: "not_found" };
  }

  // Idempotent status flip: this delivery/poll pass can be a duplicate of
  // one already processed. meta.changes === 0 means a previous call already
  // flipped this order to 'paid' (or beyond) — skip the stock decrement,
  // it already ran.
  const flip = await env.DB.prepare(
    "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_payment'"
  )
    .bind(orderId)
    .run();

  if (flip.meta.changes === 0) {
    return { orderId, status: "duplicate" };
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

  return { orderId, status: oversold ? "paid_oversold" : "paid" };
}
