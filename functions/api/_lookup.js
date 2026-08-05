import { requireAuth } from "./_auth.js";

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanDisplay(value) {
  return value.trim().replace(/\s+/g, " ");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Builds GET/POST handlers for a "nombre / nombre_normalizado" lookup table
// (fabricantes, categorias). POST is find-or-create: it never inserts a
// value whose normalized form already exists, so admin-entered casing or
// whitespace variants can't produce duplicate rows.
export function createLookupHandlers(table) {
  async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare(
      `SELECT id, nombre FROM ${table} ORDER BY nombre COLLATE NOCASE`
    ).all();
    return json(results);
  }

  async function onRequestPost({ request, env }) {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON invalido" }, 400);
    }

    const nombre = typeof body?.nombre === "string" ? cleanDisplay(body.nombre) : "";
    if (!nombre) return json({ error: "Nombre requerido" }, 400);
    const normalizado = normalize(nombre);

    const existing = await env.DB.prepare(
      `SELECT id, nombre FROM ${table} WHERE nombre_normalizado = ?`
    )
      .bind(normalizado)
      .first();
    if (existing) return json({ ok: true, ...existing, existed: true });

    try {
      const result = await env.DB.prepare(
        `INSERT INTO ${table} (nombre, nombre_normalizado) VALUES (?, ?)`
      )
        .bind(nombre, normalizado)
        .run();
      return json({ ok: true, id: result.meta.last_row_id, nombre }, 201);
    } catch {
      // Concurrent create raced us past the existence check above.
      const race = await env.DB.prepare(
        `SELECT id, nombre FROM ${table} WHERE nombre_normalizado = ?`
      )
        .bind(normalizado)
        .first();
      if (race) return json({ ok: true, ...race, existed: true });
      return json({ error: `No se pudo crear el valor en ${table}` }, 500);
    }
  }

  return { onRequestGet, onRequestPost };
}

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

// Builds PUT (rename)/DELETE handlers for a single lookup row. `productColumn`
// is the FK column on products (fabricante_id/categoria_id) used to block
// deleting a value that's still in use.
export function createLookupItemHandlers(table, productColumn) {
  async function onRequestPut({ request, env, params }) {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    const id = parseId(params);
    if (id === null) return json({ error: "ID invalido" }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON invalido" }, 400);
    }

    const nombre = typeof body?.nombre === "string" ? cleanDisplay(body.nombre) : "";
    if (!nombre) return json({ error: "Nombre requerido" }, 400);
    const normalizado = normalize(nombre);

    const otro = await env.DB.prepare(
      `SELECT id FROM ${table} WHERE nombre_normalizado = ? AND id != ?`
    )
      .bind(normalizado, id)
      .first();
    if (otro) return json({ error: "Ya existe un valor con ese nombre" }, 409);

    await env.DB.prepare(`UPDATE ${table} SET nombre = ?, nombre_normalizado = ? WHERE id = ?`)
      .bind(nombre, normalizado, id)
      .run();

    return json({ ok: true, id, nombre });
  }

  async function onRequestDelete({ request, env, params }) {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    const id = parseId(params);
    if (id === null) return json({ error: "ID invalido" }, 400);

    const enUso = await env.DB.prepare(`SELECT COUNT(*) AS total FROM products WHERE ${productColumn} = ?`)
      .bind(id)
      .first();
    if (enUso.total > 0) {
      return json({ error: `No se puede eliminar: ${enUso.total} producto(s) lo usan` }, 409);
    }

    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return { onRequestPut, onRequestDelete };
}
