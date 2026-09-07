---
name: catalog-crud
description: How products, categorias, and fabricantes are read/written through D1 and /admin — the shared lookup-table factory, the products FK model, and the admin catalog tab. Use when adding a product field, a new lookup-backed field, or touching categorias/fabricantes CRUD.
metadata:
  allowed-tools: Read, Edit, Grep, Glob, Bash
  model: sonnet
---

# Catalog CRUD (products / categorias / fabricantes)

Reference for the catalog data model and its API/admin wiring, introduced by
migration `0001`. Read this before adding a product field, a new lookup
table, or changing categorias/fabricantes behavior — don't re-derive the
`_lookup.js` factory pattern from scratch.

## Architecture at a glance

- `products` has FK columns `fabricante_id`/`categoria_id` into two
  identically-shaped lookup tables, `fabricantes` and `categorias`
  (`schema.sql`, `migrations/0001_add_fabricante_categoria_lookup_tables.sql`).
  Both lookup tables are `(id, nombre, nombre_normalizado UNIQUE)`.
- `functions/api/_lookup.js` is a factory shared by both tables — there is
  no separate `categorias.js`/`fabricantes.js` implementation, each is a
  one-line re-export:
  - `categorias.js` / `fabricantes.js`: `createLookupHandlers(table)` →
    `{ onRequestGet, onRequestPost }`.
  - `categorias/[id].js` / `fabricantes/[id].js`:
    `createLookupItemHandlers(table, productColumn)` →
    `{ onRequestPut, onRequestDelete }`.
  - Adding a **third** lookup-backed field (e.g. a new `colores` table)
    means adding a new FK column + table, then wiring these same two
    factory calls — not writing new CRUD logic.
- `products.js` / `products/[id].js` are NOT built on a shared factory —
  full CRUD is written out per-file because product validation is
  richer than "a name." Keep both files' `isValidProduct` in sync if you
  change required fields (see gotcha below).

## Lookup factory behavior (`functions/api/_lookup.js`)

- `normalize()` (line 3): lowercases, trims, collapses internal whitespace.
  `cleanDisplay()` (line 7): trims/collapses whitespace but preserves case.
  The stored `nombre` keeps the admin's casing; `nombre_normalizado` is
  what dedup and lookups key on.
- `onRequestGet` (line 23) — **no auth**, public, `ORDER BY nombre COLLATE
  NOCASE`. The storefront (`app.jsx`) reads categorias/fabricantes the
  same way it reads products.
- `onRequestPost` (line 30) — find-or-create: looks up by
  `nombre_normalizado` first; returns the existing row with
  `existed: true` rather than erroring on a duplicate. The `INSERT` is
  wrapped in try/catch to handle a concurrent create racing past the
  existence check (line 59-68) — a second normalized-name unique
  violation is treated as a race, not a real error.
- `onRequestPut` (line 83) — rename: re-checks normalized uniqueness
  against every *other* row (`AND id != ?`, line 102) before updating.
- `onRequestDelete` (line 115) — blocks deletion with 409 if
  `COUNT(*) FROM products WHERE <productColumn> = ?` is nonzero
  (line 122). This is the only place `productColumn` is used — it's why
  `createLookupItemHandlers` takes it as a second argument.
- All four handlers on **writes** call `requireAuth(request, env)` first
  (`_lookup.js` lines 31, 84, 116); only `onRequestGet` skips it. See
  `[[auth-and-sessions]]` before adding any new write path here.

## Products CRUD (`functions/api/products.js`, `products/[id].js`)

- `isValidProduct(body)` is duplicated verbatim in both files (not
  imported from a shared module) — required: `nombre` (non-empty string),
  `fabricante_id`/`categoria_id` (positive integers — these must already
  exist as rows; there's no FK-existence check beyond the SQL `REFERENCES`
  constraint, so an invalid id silently fails at the DB layer, not with a
  friendly 400), `precio` (numeric), `unidad_precio` (non-empty string).
  `imagen`/`descripcion` are optional, defaulted to `""`.
  **If you add/remove a required field, update `isValidProduct` in both
  files** — nothing enforces they stay in sync.
- `SELECT_PRODUCTS` (products.js line 17) joins in `fabricante`/`categoria`
  display names via `JOIN fabricantes`/`JOIN categorias` — so GET
  `/api/products` returns denormalized rows ready for direct render;
  POST/PUT instead take `fabricante_id`/`categoria_id` and don't return
  the joined names (the admin re-fetches via `cargarProductos()` after
  a write, see below).
- GET is public (no auth); POST/PUT/DELETE all call `requireAuth` first.

## Admin UI pattern (`admin.jsx`)

- `AdminApp()` (`admin.jsx:732`) loads all three lists once on mount
  (`admin.jsx:751-755`): `/api/products`, `/api/fabricantes`,
  `/api/categorias`. `ordenarPorNombre` keeps the lookup dropdowns sorted
  client-side after local mutations (avoids a re-fetch just to re-sort).
- Generic lookup CRUD helpers (`admin.jsx:757-794`) are factories closed
  over a path and setter, mirroring the server-side factory pattern:
  `crearValorLookup(path, setLista)`, `renombrarValorLookup(path,
  setLista)`, `eliminarValorLookup(path, setLista)` — each instantiated
  twice (once for `/api/fabricantes`, once for `/api/categorias`,
  `admin.jsx:770-794`). **Adding a third lookup-backed field**: add a
  `useState` list + these three factory calls, no new logic needed.
- `renombrarValorLookup` (`admin.jsx:773-783`) calls `cargarProductos()`
  after a successful rename (line 781) so the product table's denormalized
  `categoria`/`fabricante` display names refresh — easy to forget if you
  add a new lookup-driven display field elsewhere.
- Product create/edit is a single form (`ProductForm`, referenced at
  `admin.jsx:218`) with `onCrearFabricante`/`onCrearCategoria` callbacks
  so a new fabricante/categoria can be typed inline in the product form
  without leaving it (calls into `crearFabricante`/`crearCategoria`).
- `handleSubmit` (`admin.jsx:816-828`) branches POST vs PUT purely on
  whether `editId` is set — same `formValues` shape either way.
- `LookupManager` (rendered `admin.jsx:901-912`, toggled by
  `mostrarGestion`) is the rename/delete UI for both lookup tables —
  reused via props (`items`, `onRename`, `onDelete`), not duplicated per
  table.
- Catalog tab lives behind `vista === "catalogo"` (`admin.jsx:733`,
  `876-964`), alongside the `"contenido"` tab from
  `[[site-content-and-images]]` — both are siblings under the same
  `AdminApp`, gated by the same session check in `App()`
  (`admin.jsx:976-991`, see `[[auth-and-sessions]]`).

## Public-site consumption (`app.jsx`)

- Same `USE_API`/`API_BASE` switch as admin: when `API_BASE` is set,
  `app.jsx` fetches `/api/products` (and categorias/fabricantes as needed
  for filters); when unset, it reads the static `catalog.csv` instead.
  Don't assume the API is always live — features here must degrade to the
  CSV path too, or be explicitly gated behind `USE_API`.

## Checklist: add a new required product field

1. `schema.sql` — add the column (fresh-install schema only).
2. New `migrations/000N_*.sql` — `ALTER TABLE products ADD COLUMN ...`
   with a backfill if existing rows need a default (see migration `0001`
   for the ALTER + backfill + rebuild pattern used for a NOT NULL column
   added after the table already had rows).
3. `functions/api/products.js` **and** `functions/api/products/[id].js` —
   add the field to `isValidProduct` in both files, and to the
   `INSERT`/`UPDATE` bind lists.
4. `SELECT_PRODUCTS` in `products.js` — add the column if it's not
   `SELECT *`-covered (it isn't; it's an explicit column list).
5. `admin.jsx` — add to `EMPTY_PRODUCT` (line 8), the `ProductForm` inputs,
   and `empezarEdicion`'s field mapping (`admin.jsx:796-808`).
6. `app.jsx` — render the field wherever products are displayed.

## Checklist: add a new lookup-backed field (like a third "colores" table)

1. New `migrations/000N_*.sql` — new table shaped like `fabricantes`/
   `categorias` (`id`, `nombre`, `nombre_normalizado UNIQUE`), plus a new
   FK column on `products`.
2. `functions/api/<nombre>.js` — one-line re-export via
   `createLookupHandlers("<table>")`, same as `categorias.js`.
3. `functions/api/<nombre>/[id].js` — one-line re-export via
   `createLookupItemHandlers("<table>", "<fk_column>")`, same as
   `categorias/[id].js`.
4. `products.js`/`products/[id].js` — add the FK to `isValidProduct`,
   `SELECT_PRODUCTS`'s join, and the bind lists (same as any product
   field, see checklist above).
5. `admin.jsx` — new `useState` list, load it in the mount `useEffect`,
   instantiate the three lookup factory calls, add a `LookupManager` block
   and a dropdown in `ProductForm`.

## Gotchas / known warts

- `isValidProduct` is copy-pasted between `products.js` and
  `products/[id].js` — no shared module. Changing validation in one
  without the other is a real, easy-to-hit bug (POST accepts a field PUT
  rejects, or vice versa).
- POST/PUT on `products` don't verify `fabricante_id`/`categoria_id`
  actually exist before inserting — an invalid id fails at the SQL
  `REFERENCES` constraint level with a generic D1 error, not a friendly
  validation message. Don't assume a 500 here means something exotic.
- `nombre_normalizado` collapses whitespace and case but not accents or
  punctuation — "Lana" and "lana" collide, "Lana!" does not.
- GET on all three catalog endpoints is intentionally unauthenticated;
  every write (`POST`/`PUT`/`DELETE`) must call `requireAuth` — same rule
  as `[[site-content-and-images]]` and `[[auth-and-sessions]]`, easy to
  miss on a new endpoint since GET has no auth to copy from.

## Reference table

| File | Responsibility | Key lines |
|---|---|---|
| `functions/api/_lookup.js` | Shared factory: GET/POST/PUT/DELETE for lookup tables | full file |
| `functions/api/categorias.js`, `fabricantes.js` | One-line factory instantiation (list+create) | full file |
| `functions/api/categorias/[id].js`, `fabricantes/[id].js` | One-line factory instantiation (rename+delete) | full file |
| `functions/api/products.js` | List+create products, `isValidProduct`, `SELECT_PRODUCTS` | full file |
| `functions/api/products/[id].js` | Update+delete a single product | full file |
| `migrations/0001_add_fabricante_categoria_lookup_tables.sql` | Lookup-table introduction + backfill pattern | full file |
| `schema.sql` | Fresh-install table shapes | 1-20 |
| `admin.jsx` | Catalog tab, lookup CRUD factories, `ProductForm`, `LookupManager` | 732-794, 816-964 |

## See also / non-goals

- Site content/non-catalog images — separate JSON-blob pattern, see
  `[[site-content-and-images]]`.
- Auth/session mechanics — see `[[auth-and-sessions]]`.
- Image upload for the product `imagen` field reuses the same
  `functions/api/upload.js` as content images — see the upload section in
  `[[site-content-and-images]]`.
