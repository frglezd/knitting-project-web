import { requireAuth } from "./_auth.js";

const SELECT_ORDERS = `
  SELECT id, created_at, customer_name, customer_email, customer_phone,
         fulfillment_method, status, payment_provider, payment_provider_ref,
         total, currency, notes
  FROM orders
`;

const SELECT_ORDER_ITEMS = `
  SELECT order_id, id, product_id, product_color_id, product_nombre,
         color_nombre, unidad_precio, precio_unitario, cantidad, subtotal
  FROM order_items
`;

// Attaches each order's line items as an `items` array — same
// second-query-plus-in-memory-grouping shape as products.js's
// attachColores (SELECT_PRODUCT_COLORES/attachColores).
function attachItems(orders, itemRows) {
  const porOrden = new Map();
  for (const fila of itemRows) {
    const lista = porOrden.get(fila.order_id) || [];
    lista.push(fila);
    porOrden.set(fila.order_id, lista);
  }
  return orders.map((o) => ({ ...o, items: porOrden.get(o.id) || [] }));
}

export async function onRequestGet({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const [{ results: orders }, { results: itemRows }] = await Promise.all([
    env.DB.prepare(`${SELECT_ORDERS} ORDER BY id DESC`).all(),
    env.DB.prepare(SELECT_ORDER_ITEMS).all(),
  ]);

  return new Response(JSON.stringify(attachItems(orders, itemRows)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
