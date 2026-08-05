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

  const { nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion } = body;
  await env.DB.prepare(
    "UPDATE products SET nombre = ?, fabricante_id = ?, categoria_id = ?, imagen = ?, precio = ?, unidad_precio = ?, descripcion = ? WHERE id = ?"
  )
    .bind(
      nombre,
      Number(fabricante_id),
      Number(categoria_id),
      imagen || "",
      Number(precio),
      unidad_precio,
      descripcion || "",
      id
    )
    .run();

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

  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
