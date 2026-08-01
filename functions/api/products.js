import { requireAuth } from "./_auth.js";

function isValidProduct(body) {
  return (
    body &&
    typeof body.nombre === "string" &&
    body.nombre &&
    typeof body.fabricante === "string" &&
    body.fabricante &&
    typeof body.categoria === "string" &&
    body.categoria &&
    body.precio != null &&
    !Number.isNaN(Number(body.precio)) &&
    typeof body.unidad_precio === "string" &&
    body.unidad_precio
  );
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY id").all();
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

  const { nombre, fabricante, categoria, imagen, precio, unidad_precio, descripcion } = body;
  const result = await env.DB.prepare(
    "INSERT INTO products (nombre, fabricante, categoria, imagen, precio, unidad_precio, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(nombre, fabricante, categoria, imagen || "", Number(precio), unidad_precio, descripcion || "")
    .run();

  return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
