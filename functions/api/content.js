import { requireAuth } from "./_auth.js";

const ROW_ID = 1;

function isValidContent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  if (body.testimonios != null) {
    if (!Array.isArray(body.testimonios)) return false;
    const validos = body.testimonios.every(
      (t) => t && typeof t.nombre === "string" && typeof t.texto === "string"
    );
    if (!validos) return false;
  }

  if (body.imagenes != null) {
    if (typeof body.imagenes !== "object" || Array.isArray(body.imagenes)) return false;
    const validas = Object.values(body.imagenes).every((v) => typeof v === "string");
    if (!validas) return false;
  }

  return true;
}

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT content FROM site_content WHERE id = ?").bind(ROW_ID).first();
  return new Response(row ? row.content : "null", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPut({ request, env }) {
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

  if (!isValidContent(body)) {
    return new Response(JSON.stringify({ error: "Contenido invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare(
    "INSERT INTO site_content (id, content) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content"
  )
    .bind(ROW_ID, JSON.stringify(body))
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
