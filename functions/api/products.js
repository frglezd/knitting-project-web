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
         p.unidad_precio, p.descripcion
  FROM products p
  JOIN fabricantes f ON f.id = p.fabricante_id
  JOIN categorias c ON c.id = p.categoria_id
`;

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`${SELECT_PRODUCTS} ORDER BY p.id`).all();
  return new Response(JSON.stringify(results), {
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

  const { nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion } = body;
  const result = await env.DB.prepare(
    "INSERT INTO products (nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      nombre,
      Number(fabricante_id),
      Number(categoria_id),
      imagen || "",
      Number(precio),
      unidad_precio,
      descripcion || ""
    )
    .run();

  return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
