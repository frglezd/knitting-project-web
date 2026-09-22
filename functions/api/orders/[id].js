import { requireAuth } from "../_auth.js";

const VALID_STATUSES = [
  "pending_payment",
  "paid",
  "paid_oversold",
  "fulfilled",
  "payment_failed",
  "cancelled",
];

const SELECT_ORDER = `
  SELECT id, created_at, customer_name, customer_email, customer_phone,
         fulfillment_method, status, payment_provider, payment_provider_ref,
         total, currency, notes
  FROM orders WHERE id = ?
`;

const SELECT_ORDER_ITEMS = `
  SELECT id, product_id, product_color_id, product_nombre, color_nombre,
         unidad_precio, precio_unitario, cantidad, subtotal
  FROM order_items WHERE order_id = ?
`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

export async function onRequestGet({ request, env, params }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const id = parseId(params);
  if (id === null) {
    return json({ error: "ID invalido" }, 400);
  }

  const [order, { results: items }] = await Promise.all([
    env.DB.prepare(SELECT_ORDER).bind(id).first(),
    env.DB.prepare(SELECT_ORDER_ITEMS).bind(id).all(),
  ]);

  if (!order) {
    return json({ error: "Pedido no encontrado" }, 404);
  }

  return json({ ...order, items });
}

export async function onRequestPut({ request, env, params }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const id = parseId(params);
  if (id === null) {
    return json({ error: "ID invalido" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON invalido" }, 400);
  }

  if (!VALID_STATUSES.includes(body && body.status)) {
    return json({ error: "Estado invalido" }, 400);
  }

  const result = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
    .bind(body.status, id)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "Pedido no encontrado" }, 404);
  }

  return json({ ok: true });
}
