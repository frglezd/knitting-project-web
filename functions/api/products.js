import { requireAuth } from "./_auth.js";

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

const SELECT_PRODUCTS = `
  SELECT p.id, p.nombre, p.fabricante_id, f.nombre AS fabricante,
         p.categoria_id, c.nombre AS categoria, p.imagen, p.precio,
         p.unidad_precio, p.descripcion, p.stock
  FROM products p
  JOIN fabricantes f ON f.id = p.fabricante_id
  JOIN categorias c ON c.id = p.categoria_id
`;

const SELECT_PRODUCT_COLORES = `
  SELECT pc.product_id, pc.color_id, co.nombre, co.hex, pc.stock
  FROM product_colores pc
  JOIN colores co ON co.id = pc.color_id
  ORDER BY co.nombre COLLATE NOCASE
`;

function coerceStock(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.trunc(Number(value)) : 0;
}

// Attaches each product's color variants (if any) as a `colores` array.
function attachColores(productos, coloresRows) {
  const porProducto = new Map();
  for (const fila of coloresRows) {
    const lista = porProducto.get(fila.product_id) || [];
    lista.push({
      id: fila.color_id,
      color_id: fila.color_id,
      nombre: fila.nombre,
      hex: fila.hex,
      stock: fila.stock,
    });
    porProducto.set(fila.product_id, lista);
  }
  return productos.map((p) => ({ ...p, colores: porProducto.get(p.id) || [] }));
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

export async function onRequestGet({ env }) {
  const [{ results: productos }, { results: coloresRows }] = await Promise.all([
    env.DB.prepare(`${SELECT_PRODUCTS} ORDER BY p.id`).all(),
    env.DB.prepare(SELECT_PRODUCT_COLORES).all(),
  ]);
  return new Response(JSON.stringify(attachColores(productos, coloresRows)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

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

  const { nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion, colores } = body;
  const stock = coerceStock(body.stock);
  const result = await env.DB.prepare(
    "INSERT INTO products (nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      nombre,
      Number(fabricante_id),
      Number(categoria_id),
      imagen || "",
      Number(precio),
      unidad_precio,
      descripcion || "",
      stock
    )
    .run();

  const productId = result.meta.last_row_id;
  if (Array.isArray(colores) && colores.length > 0) {
    await env.DB.batch(buildColoresBatch(env, productId, colores));
  }

  return new Response(JSON.stringify({ ok: true, id: productId }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
