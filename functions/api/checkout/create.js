// POST /api/checkout/create — public (no requireAuth: customers are
// anonymous, same model as GET /api/products being public). Creates a
// pending order + all of its line items (one per cart line — a customer's
// cart can hold several products/colors), then a Stripe Checkout Session
// for payment. Stock is only *checked* here, defensively — it is never
// decremented until the webhook confirms payment (see webhook.js and the
// plan's Section 3).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Validates `cantidad` against the product's unidad_precio: a positive
// integer multiple of 100 for gram-priced yarn, or any positive integer
// (whole skeins/pieces) otherwise.
function isValidCantidad(cantidad, unidadPrecio) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return false;
  if (unidadPrecio === "gramos") return cantidad % 100 === 0;
  return true;
}

// Quantity-in-name suffix for Stripe's line item — required regardless of
// cart size (even a single-item order needs it), since it's what shows in
// Stripe's dashboard/payout details and gramos pricing doesn't map to
// Stripe's native `quantity` concept (quantity is always sent as 1, the
// real amount is folded into unit_amount instead). Wording matches
// admin.jsx's STOCK_UNIT_LABEL (gramos -> "g", madeja -> "madejas",
// unidad -> "piezas"), with singular/plural for whole-piece units.
export function formatCantidadUnidad(cantidad, unidadPrecio) {
  if (unidadPrecio === "gramos") return `${cantidad} g`;
  if (unidadPrecio === "madeja") return `${cantidad} ${cantidad === 1 ? "madeja" : "madejas"}`;
  if (unidadPrecio === "unidad") return `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"}`;
  return `${cantidad} ${unidadPrecio}`;
}

export function formatLineName(nombre, colorNombre, unidadPrecio, cantidad) {
  const base = nombre + (colorNombre ? ` - ${colorNombre}` : "");
  return `${base} (${formatCantidadUnidad(cantidad, unidadPrecio)})`;
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON invalido" }, 400);
  }

  const { items, customer_name, customer_email, customer_phone } = body || {};

  if (!isNonEmptyString(customer_name) || !isNonEmptyString(customer_email)) {
    return json({ error: "Nombre y correo son obligatorios" }, 400);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "El carrito esta vacio" }, 400);
  }

  // Shape-validate every raw item first, tagging each with its original
  // index so error reporting references the client's own item order (even
  // after the server-side merge below collapses duplicates). Collects every
  // failure rather than bailing on the first malformed item.
  const shapeErrors = [];
  const parsedItems = [];
  items.forEach((raw, index) => {
    const r = raw || {};
    const productId = Number(r.product_id);
    const cantidad = Number(r.cantidad);
    const hasColor = r.product_color_id != null && r.product_color_id !== "";
    const productColorId = hasColor ? Number(r.product_color_id) : null;

    if (!Number.isInteger(productId) || productId <= 0) {
      shapeErrors.push({
        index,
        product_id: r.product_id ?? null,
        product_color_id: r.product_color_id ?? null,
        error: "Producto invalido",
      });
      return;
    }
    if (hasColor && (!Number.isInteger(productColorId) || productColorId <= 0)) {
      shapeErrors.push({ index, product_id: productId, product_color_id: r.product_color_id, error: "Color invalido" });
      return;
    }

    parsedItems.push({ index, product_id: productId, product_color_id: productColorId, cantidad });
  });

  if (shapeErrors.length > 0) {
    return json({ error: "Uno o mas productos no son validos", items: shapeErrors }, 400);
  }

  // Server-side merge by (product_id, product_color_id), summing cantidad —
  // never trust the client already deduplicated (same class of defense as
  // hasDuplicateColorId in products.js). Keeps the first original index for
  // error reporting on the merged line.
  const mergedMap = new Map();
  const mergedItems = [];
  for (const it of parsedItems) {
    const key = `${it.product_id}:${it.product_color_id ?? "none"}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.cantidad += it.cantidad;
    } else {
      const merged = { index: it.index, product_id: it.product_id, product_color_id: it.product_color_id, cantidad: it.cantidad };
      mergedMap.set(key, merged);
      mergedItems.push(merged);
    }
  }

  // Batch-fetch: one query for all referenced products, one grouped query
  // for all their product_colores rows — not N sequential awaits.
  const productIds = Array.from(new Set(mergedItems.map((it) => it.product_id)));
  const placeholders = productIds.map(() => "?").join(",");

  const { results: productos } = await env.DB.prepare(
    `SELECT id, nombre, precio, unidad_precio, stock FROM products WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all();
  const productosPorId = new Map(productos.map((p) => [p.id, p]));

  const { results: coloresRows } = await env.DB.prepare(
    `SELECT pc.id, pc.product_id, pc.stock, co.nombre
     FROM product_colores pc
     JOIN colores co ON co.id = pc.color_id
     WHERE pc.product_id IN (${placeholders})`
  )
    .bind(...productIds)
    .all();
  const coloresPorProducto = new Map();
  for (const fila of coloresRows) {
    const lista = coloresPorProducto.get(fila.product_id) || [];
    lista.push(fila);
    coloresPorProducto.set(fila.product_id, lista);
  }

  // Apply today's exact three per-item validation rules to every item,
  // collecting failures by index rather than stopping at the first. If ANY
  // item fails, the whole request is rejected below — no partial order.
  const errores = [];
  const validados = [];

  for (const it of mergedItems) {
    const producto = productosPorId.get(it.product_id);
    if (!producto) {
      errores.push({ index: it.index, product_id: it.product_id, product_color_id: it.product_color_id, error: "Producto no encontrado" });
      continue;
    }

    if (!isValidCantidad(it.cantidad, producto.unidad_precio)) {
      errores.push({
        index: it.index,
        product_id: it.product_id,
        product_color_id: it.product_color_id,
        error: producto.unidad_precio === "gramos" ? "La cantidad debe ser un múltiplo de 100 gramos" : "Cantidad invalida",
      });
      continue;
    }

    const coloresProducto = coloresPorProducto.get(it.product_id) || [];
    let colorSeleccionado = null;
    if (it.product_color_id != null) {
      colorSeleccionado = coloresProducto.find((c) => c.id === it.product_color_id) || null;
      if (!colorSeleccionado) {
        errores.push({ index: it.index, product_id: it.product_id, product_color_id: it.product_color_id, error: "Color invalido" });
        continue;
      }
    } else if (coloresProducto.length > 0) {
      errores.push({ index: it.index, product_id: it.product_id, product_color_id: it.product_color_id, error: "Debes elegir un color" });
      continue;
    }

    const stockDisponible = colorSeleccionado ? colorSeleccionado.stock : producto.stock;
    if (stockDisponible < it.cantidad) {
      errores.push({ index: it.index, product_id: it.product_id, product_color_id: it.product_color_id, error: "Existencias insuficientes" });
      continue;
    }

    const precioUnitario = Number(producto.precio);
    const subtotal = round2(precioUnitario * (producto.unidad_precio === "gramos" ? it.cantidad / 100 : it.cantidad));

    validados.push({
      product_id: it.product_id,
      product_color_id: colorSeleccionado ? colorSeleccionado.id : null,
      product_nombre: producto.nombre,
      color_nombre: colorSeleccionado ? colorSeleccionado.nombre : null,
      unidad_precio: producto.unidad_precio,
      precio_unitario: precioUnitario,
      cantidad: it.cantidad,
      subtotal,
    });
  }

  if (errores.length > 0) {
    return json({ error: "Uno o mas productos no estan disponibles", items: errores }, 400);
  }

  const total = round2(validados.reduce((sum, v) => sum + v.subtotal, 0));

  const orderResult = await env.DB.prepare(
    `INSERT INTO orders (customer_name, customer_email, customer_phone, total)
     VALUES (?, ?, ?, ?)`
  )
    .bind(customer_name.trim(), customer_email.trim(), customer_phone || null, total)
    .run();

  const orderId = orderResult.meta.last_row_id;

  // All order_items rows inserted atomically via one batch (all-or-nothing
  // across N inserts), not a sequence of independent .run() calls.
  const itemStatements = validados.map((v) =>
    env.DB.prepare(
      `INSERT INTO order_items
         (order_id, product_id, product_color_id, product_nombre, color_nombre,
          unidad_precio, precio_unitario, cantidad, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId,
      v.product_id,
      v.product_color_id,
      v.product_nombre,
      v.color_nombre,
      v.unidad_precio,
      v.precio_unitario,
      v.cantidad,
      v.subtotal
    )
  );
  await env.DB.batch(itemStatements);

  const origin = request.headers.get("Origin") || new URL(request.url).origin;

  // One Stripe line_items[i] per cart line — not folded into one. Each
  // unit_amount independently equals that item's own subtotal in centavos.
  const params = new URLSearchParams();
  params.set("mode", "payment");
  validados.forEach((v, i) => {
    const name = formatLineName(v.product_nombre, v.color_nombre, v.unidad_precio, v.cantidad);
    params.set(`line_items[${i}][price_data][currency]`, "mxn");
    params.set(`line_items[${i}][price_data][product_data][name]`, name);
    params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(v.subtotal * 100)));
    params.set(`line_items[${i}][quantity]`, "1");
  });
  params.set("success_url", `${origin}/?order=${orderId}&status=success`);
  params.set("cancel_url", `${origin}/?order=${orderId}&status=cancelled`);
  params.set("metadata[order_id]", String(orderId));

  let stripeRes;
  try {
    stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } catch (err) {
    // Log the real cause — the generic customer-facing message below
    // deliberately doesn't leak Stripe's error detail, but that means
    // this is the only place the actual reason (network failure here,
    // vs. a rejected request below) is visible at all.
    console.error("Fallo la llamada a Stripe (orderId=" + orderId + "):", err);
    return json({ error: "No se pudo iniciar el pago" }, 502);
  }

  if (!stripeRes.ok) {
    const detail = await stripeRes.text().catch(() => "");
    console.error(
      "Stripe respondio " + stripeRes.status + " (orderId=" + orderId + "):",
      detail
    );
    return json({ error: "No se pudo iniciar el pago" }, 502);
  }

  const session = await stripeRes.json();

  await env.DB.prepare("UPDATE orders SET payment_provider_ref = ? WHERE id = ?")
    .bind(session.id, orderId)
    .run();

  return json({ checkout_url: session.url });
}
