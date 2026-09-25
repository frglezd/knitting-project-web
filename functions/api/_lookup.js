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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Builds GET/POST handlers for a "nombre / nombre_normalizado" lookup table
// (fabricantes, categorias, colores). POST is find-or-create: it never
// inserts a value whose normalized form already exists, so admin-entered
// casing or whitespace variants can't produce duplicate rows.
//
// `extraColumn` is optional, only used by colores today: { name, default,
// validate(value) => cleaned value or null if invalid }. When present, GET
// includes it in the SELECT and POST reads/validates/defaults it. Leaving it
// unset keeps fabricantes/categorias behavior identical to before.
export function createLookupHandlers(table, extraColumn) {
  const columns = extraColumn ? `id, nombre, ${extraColumn.name}` : "id, nombre";

  function withExtra(body, target) {
    if (!extraColumn) return target;
    const raw = body?.[extraColumn.name];
    const valido = typeof raw === "string" ? extraColumn.validate(raw) : null;
    return { ...target, [extraColumn.name]: valido ?? extraColumn.default };
  }

  async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare(
      `SELECT ${columns} FROM ${table} ORDER BY nombre COLLATE NOCASE`
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
      `SELECT ${columns} FROM ${table} WHERE nombre_normalizado = ?`
    )
      .bind(normalizado)
      .first();
    if (existing) return json({ ok: true, ...existing, existed: true });

    const extra = withExtra(body, {});

    try {
      const result = extraColumn
        ? await env.DB.prepare(
            `INSERT INTO ${table} (nombre, nombre_normalizado, ${extraColumn.name}) VALUES (?, ?, ?)`
          )
            .bind(nombre, normalizado, extra[extraColumn.name])
            .run()
        : await env.DB.prepare(
            `INSERT INTO ${table} (nombre, nombre_normalizado) VALUES (?, ?)`
          )
            .bind(nombre, normalizado)
            .run();
      return json({ ok: true, id: result.meta.last_row_id, nombre, ...extra }, 201);
    } catch {
      // Concurrent create raced us past the existence check above.
      const race = await env.DB.prepare(
        `SELECT ${columns} FROM ${table} WHERE nombre_normalizado = ?`
      )
        .bind(normalizado)
        .first();
      if (race) return json({ ok: true, ...race, existed: true });
      return json({ error: `No se pudo crear el valor en ${table}` }, 500);
    }
  }

  return { onRequestGet, onRequestPost };
}

// Validates/normalizes a hex color string (#RGB or #RRGGBB), returning null
// when malformed so the caller can fall back to a default.
export function validateHex(value) {
  const cleaned = value.trim();
  return HEX_COLOR_RE.test(cleaned) ? cleaned : null;
}

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

// Builds PUT (rename)/DELETE handlers for a single lookup row. `usage` is
// either a plain FK column name on `products` (fabricante_id/categoria_id,
// the common case) or, when the lookup id isn't a direct column on
// `products` (e.g. colores, referenced via product_colores.color_id),
// an object `{ table, column }` naming the table/column to check instead.
// Either form blocks deleting a value that's still in use.
export function createLookupItemHandlers(table, usage, extraColumn) {
  const usageTable = typeof usage === "string" ? "products" : usage.table;
  const usageColumn = typeof usage === "string" ? usage : usage.column;
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

    let extraValue;
    if (extraColumn) {
      const raw = body?.[extraColumn.name];
      const valido = typeof raw === "string" ? extraColumn.validate(raw) : null;
      extraValue = valido ?? extraColumn.default;
    }

    const sql = extraColumn
      ? `UPDATE ${table} SET nombre = ?, nombre_normalizado = ?, ${extraColumn.name} = ? WHERE id = ?`
      : `UPDATE ${table} SET nombre = ?, nombre_normalizado = ? WHERE id = ?`;
    const binds = extraColumn ? [nombre, normalizado, extraValue, id] : [nombre, normalizado, id];
    await env.DB.prepare(sql).bind(...binds).run();

    return json({ ok: true, id, nombre, ...(extraColumn ? { [extraColumn.name]: extraValue } : {}) });
  }

  async function onRequestDelete({ request, env, params }) {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    const id = parseId(params);
    if (id === null) return json({ error: "ID invalido" }, 400);

    const enUso = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${usageTable} WHERE ${usageColumn} = ?`)
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
