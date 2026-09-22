import { requireAuth } from "../_auth.js";

function isValidProduct(body) {
  return (
    body &&
    typeof body.nombre === "string" &&
    body.nombre &&
    Number.isInteger(Number(body.fabricante_id)) &&
    Number(body.fabricante_id) > 0 &&
    Number.isInteger(Number(body.categoria_id)) &&
    Number(body.categoria_id) > 0 &&
    body.precio != null &&
    !Number.isNaN(Number(body.precio)) &&
    typeof body.unidad_precio === "string" &&
    body.unidad_precio
  );
}

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

function coerceStock(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.trunc(Number(value)) : 0;
}

// The same color can't appear twice in one product's variant list — a
// second row for a color_id already used would collide with
// product_colores' UNIQUE(product_id, color_id) constraint (and, via a
// quirk of how D1/SQLite reports it inside a batch, surfaces as a raw
// "FOREIGN KEY constraint failed" 500 instead of a clean validation
// error). Checked up front so a bad request never reaches the DB.
function hasDuplicateColorId(colores) {
  const seen = new Set();
  for (const c of Array.isArray(colores) ? colores : []) {
    const colorId = Number(c && c.color_id);
    if (!Number.isInteger(colorId) || colorId <= 0) continue;
    if (seen.has(colorId)) return true;
    seen.add(colorId);
  }
  return false;
}

// Replaces a product's product_colores rows to match `colores` (an array of
// { color_id, stock }). Delete-then-reinsert, batched into one transaction —
// fine for this admin-only, low-volume table. Empty/absent array just clears
// any existing rows (no color choice for that product).
function buildColoresBatch(env, productId, colores) {
  const statements = [env.DB.prepare("DELETE FROM product_colores WHERE product_id = ?").bind(productId)];
  for (const c of Array.isArray(colores) ? colores : []) {
    const colorId = Number(c && c.color_id);
    if (!Number.isInteger(colorId) || colorId <= 0) continue;
    statements.push(
      env.DB.prepare("INSERT INTO product_colores (product_id, color_id, stock) VALUES (?, ?, ?)").bind(
        productId,
        colorId,
        coerceStock(c.stock)
      )
    );
  }
  return statements;
}

export async function onRequestPut({ request, env, params }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const id = parseId(params);
  if (id === null) {
    return new Response(JSON.stringify({ error: "ID invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isValidProduct(body)) {
    return new Response(JSON.stringify({ error: "Faltan campos obligatorios" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (hasDuplicateColorId(body.colores)) {
    return new Response(JSON.stringify({ error: "No puedes repetir el mismo color en un producto" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion, colores } = body;
  const stock = coerceStock(body.stock);

  // One batch, not a separate .run() + .batch(): if the colores half ever
  // failed after the product UPDATE had already committed on its own, the
  // product's other fields (nombre/precio/stock/etc.) would silently save
  // while the request as a whole still reported an error — exactly what
  // happened before this was combined.
  const updateProducto = env.DB.prepare(
    "UPDATE products SET nombre = ?, fabricante_id = ?, categoria_id = ?, imagen = ?, precio = ?, unidad_precio = ?, descripcion = ?, stock = ? WHERE id = ?"
  ).bind(
    nombre,
    Number(fabricante_id),
    Number(categoria_id),
    imagen || "",
    Number(precio),
    unidad_precio,
    descripcion || "",
    stock,
    id
  );

  await env.DB.batch([updateProducto, ...buildColoresBatch(env, id, colores)]);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestDelete({ request, env, params }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const id = parseId(params);
  if (id === null) {
    return new Response(JSON.stringify({ error: "ID invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // order_items.product_id is NOT NULL (unlike product_color_id, which is
  // fine going NULL — see migration 0008), so a product with real order
  // history genuinely can't be deleted without corrupting that history.
  // Guard it explicitly, same "blocked while in use" pattern as
  // _lookup.js's fabricantes/categorias delete, instead of letting a raw
  // FK-constraint error leak out as a 500.
  const enUso = await env.DB.prepare("SELECT COUNT(*) AS total FROM order_items WHERE product_id = ?")
    .bind(id)
    .first();
  if (enUso.total > 0) {
    return new Response(
      JSON.stringify({ error: `No se puede eliminar: ${enUso.total} pedido(s) lo referencian` }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // product_colores.product_id has no ON DELETE CASCADE, so a product with
  // color variants must have those rows removed first or the delete fails
  // with a raw FK-constraint error.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM product_colores WHERE product_id = ?").bind(id),
    env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id),
  ]);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
