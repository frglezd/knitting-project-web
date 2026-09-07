---
name: site-content-and-images
description: How site copy and non-catalog images (hero, nosotros, category tiles, logo, testimonials) are managed through D1 and /admin. Use when adding or editing a content field, or adding a new non-catalog image slot.
metadata:
  allowed-tools: Read, Edit, Grep, Glob, Bash
  model: sonnet
---

# Site content & non-catalog images (D1 + /admin)

Reference for extending the pattern introduced in commit `22bf64e`. Read
this before adding a new editable text field or a new non-catalog image
slot — don't re-derive the architecture from scratch.

## Architecture at a glance

- One D1 table, `site_content`, holds a **single row** (`id = 1`) whose
  `content` column is a JSON blob — not a normalized column/table per
  field. See "Why a JSON blob" below before changing this.
- Fallback/override chain, lowest to highest priority:
  1. `default-content.js` — demo copy, tracked in git.
  2. `default-content-prod.js` — real copy, gitignored, swapped in via
     `index.html`'s `<script src>`.
  3. `window.APP_CONFIG.CONTENT` in `config.js` — gitignored, partial
     override.
  4. D1 `site_content` row, fetched at runtime via `GET /api/content` —
     overrides everything above, only if a row exists.
- Public site (`app.jsx`) and admin (`admin.jsx`) both read/write the
  *same* JSON shape and the *same* static fallback objects — a new field
  must be added to both, plus the static defaults, plus validation if it
  needs any.
- See `README.md` for the user-facing (Spanish) explanation of the
  three override methods — this file is the implementation-pattern
  reference, not user docs; don't duplicate that section here.

## Data model: why a JSON blob, not normalized columns

`migrations/0002_add_site_content.sql` (13 lines, full file):

```sql
CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL
);
```

Rationale, from the migration's own comment: this is one settings object,
not a list of independent items — no per-row CRUD, no listing/pagination
needed. **Do not** create a new normalized table or a new column on this
table for a new field. Every new field is just a new key inside the
existing JSON blob, optionally validated in `isValidContent`.

## Request flow

`functions/api/content.js` (65 lines, full file):
- `onRequestGet` (lines 25-31) — **no auth**, public (the storefront
  needs it). `SELECT content FROM site_content WHERE id = ?` bound to
  `1`; returns the stored JSON string as-is, or the string `"null"` if
  no row exists yet.
- `onRequestPut` (lines 33-64) — calls `requireAuth(request, env)`
  first (same cookie-session auth as catalog writes, from `_auth.js`),
  then `isValidContent(body)` (lines 5-23), then upserts:
  `INSERT INTO site_content (id, content) VALUES (?, ?) ON CONFLICT(id)
  DO UPDATE SET content = excluded.content`.
- `isValidContent` only validates shape for `testimonios` (must be an
  array of `{nombre, texto}` strings) and `imagenes` (must be a flat
  object of string values). Every other key is accepted as-is, untyped.

## Public-site consumption pattern

`app.jsx:20`: `CONTENT` is declared with `let`, not `const`, on
purpose — components read `CONTENT.xxx` as a free variable on every
render. `App()`'s fetch/merge `useEffect` (`app.jsx:670-680`) fetches
`GET /api/content` on mount (only when `USE_API`), does
`CONTENT = { ...CONTENT, ...data }`, then calls
`forzarRerender((n) => n + 1)` to force a re-render, since reassigning a
module-level variable doesn't itself trigger React updates. This is the
repo's deliberate substitute for prop drilling/Context — don't refactor
it into Context as an unrelated "cleanup".

Image fields are read with an inline static-asset fallback, e.g.
`app.jsx:275`:

```js
src={CONTENT.imagenes?.hero || "assets/images/cesta-ovillos-ganchillos.jpg"}
```

Category tiles look up a per-tile key via `tile.imagenKey`
(`CATEGORY_TILES` defined at `app.jsx:294-317`; lookup at
`app.jsx:336`): `CONTENT.imagenes?.[tile.imagenKey] || tile.imagen`.

## Admin UI pattern (`admin.jsx`)

- `AdminApp()` (`admin.jsx:732`) has `vista` state (`"catalogo"` |
  `"contenido"`) toggling tabs; `ContentSettings` renders at
  `admin.jsx:874` when `vista === "contenido"`.
- Field-group arrays drive the form layout — adding a field to the
  right array is most of the work:
  - `CONTENT_TEXT_FIELDS` (`admin.jsx:472`) — single-line `<input>`,
    rendered by the loop at `admin.jsx:633`.
  - `CONTENT_TEXTAREA_FIELDS` (`admin.jsx:487`) — `<textarea>`,
    rendered by the loop at `admin.jsx:646`.
  - `CONTENT_IMAGE_FIELDS` (`admin.jsx:494`) — image slots under the
    flat `imagenes.<key>` shape, rendered generically via `ImageField`
    in the loop at `admin.jsx:669`. `logo`, `imagenes.hero`, and
    `imagenes.nosotros` are instead rendered as separate explicit
    `ImageField` calls (`admin.jsx:662-667`) because `logo` isn't under
    `imagenes.*` and hero/nosotros predate the generic array.
- `ContentSettings()` (`admin.jsx:560`): seeds `valores` state from
  `window.DEFAULT_CONTENT` + `window.APP_CONFIG.CONTENT`
  (`admin.jsx:562-563`), then overlays `GET /api/content`
  (`admin.jsx:571`) — same fallback chain as the public site, so the
  form is always pre-filled even before any D1 row exists (the first
  save doubles as the migration into D1). Submits the whole `valores`
  object via `PUT /api/content` (`admin.jsx:617`).
- `ImageField` (`admin.jsx:500-558`): reusable — thumbnail preview, raw
  URL text input (manual/fallback entry), and a file input that calls
  `resizeImageIfNeeded(file)` then `POST /api/upload`, storing the
  returned `url`. Same component used for product images elsewhere —
  don't duplicate it.

## Checklist: add a new text/textarea content field

1. `default-content.js` — add the key with demo copy (top-level, next
   to existing fields).
2. `default-content-prod.js` — add the key with real copy (gitignored;
   edit locally, it won't show up in git history).
3. `config.example.js` — add a commented-out example line for the key
   so operators know it's overridable via `config.js`.
4. `admin.jsx` — add `{ key, label }` to `CONTENT_TEXT_FIELDS` (line
   472) or `CONTENT_TEXTAREA_FIELDS` (line 487). No other admin.jsx
   change needed — the render loop and change handler are generic.
5. `app.jsx` — read `CONTENT.<yourKey>` wherever it should render.
6. If the field needs shape validation beyond "any string" (e.g. must
   be a URL, must be one of an enum), add a check to `isValidContent`
   in `functions/api/content.js` — otherwise it's silently accepted
   as-is.
7. No D1 migration needed — it's just a new key in the existing JSON
   blob.

## Checklist: add a new non-catalog image slot

1. Decide the key path: a top-level key like `logo` (needs an explicit
   `ImageField` call), or a new `imagenes.<newKey>` that fits the flat
   object pattern (add to `CONTENT_IMAGE_FIELDS` at `admin.jsx:494`
   instead).
2. `default-content.js` — add the key (under `imagenes: {...}` or
   top-level) with a demo asset path.
3. `default-content-prod.js` — same key, real asset/URL.
4. `config.example.js` — extend the `imagenes: { ... }` example
   comment.
5. `admin.jsx` — either add to `CONTENT_IMAGE_FIELDS`, or add an
   explicit `<ImageField label=... value={valores.imagenes?.newKey}
   onChange={setImagen("newKey")} />` next to the `logo`/`hero`/
   `nosotros` calls (`admin.jsx:662-667`).
6. `app.jsx` — render with the same fallback idiom as existing image
   reads: `CONTENT.imagenes?.newKey || "assets/images/<static-fallback>.jpg"`.
7. `isValidContent` already validates `imagenes` generically (all
   values must be strings) — no change needed unless the new key has
   extra constraints.
8. Reuse `functions/api/upload.js` as-is for the actual file upload —
   do not write a new upload endpoint. See the key-prefix wart below
   before touching it.

## Gotchas / known warts

- **`upload.js`'s storage key is `products/<uuid>.<ext>` for every
  upload**, including non-catalog site images (`functions/api/upload.js`,
  ~line 47). This is a pre-existing wart, not something `22bf64e`
  introduced or fixed — don't "fix" the prefix as a drive-by change in
  an unrelated task; if it's ever fixed, it needs a deliberate migration
  plan for existing R2 keys, not just a code change.
- `GET /api/content` is intentionally unauthenticated (the storefront
  needs it); only `PUT` calls `requireAuth`. Any new write endpoint on
  this table must gate on `requireAuth` the same way — easy to miss
  since GET doesn't have it.
- `isValidContent` validates `testimonios` and `imagenes` shapes but
  nothing else — a bad value for any other key is accepted silently and
  stored. Add an explicit check if a new field needs stronger
  guarantees.
- Content lives in **four places** that must be kept in sync manually:
  `default-content.js`, `default-content-prod.js` (gitignored, no
  compiler/lint catches drift), `config.example.js`'s comment block, and
  the admin field-group arrays. Missing one doesn't error — it just
  means the field is invisible in the admin form or has no fallback.
- `CONTENT` is a mutable module-level `let` in `app.jsx`; re-render is
  forced manually via `forzarRerender`. This is deliberate (see "Public-
  site consumption pattern" above), not something to refactor into
  Context/props as a cleanup.
- No new D1 migration is needed for new fields/keys — only for schema
  changes to the `site_content` table itself, which should be rare or
  never for this pattern.

## Reference table

| File | Responsibility | Key lines |
|---|---|---|
| `functions/api/content.js` | GET/PUT `/api/content`, `isValidContent` | 1-65 |
| `migrations/0002_add_site_content.sql` | `site_content` table + JSON-blob rationale | 1-13 |
| `schema.sql` | Same table, fresh-install schema | ~24-27 |
| `default-content.js` | Demo copy, tracked | full file |
| `default-content-prod.js` | Real copy, gitignored | full file |
| `config.example.js` | Documents overridable `CONTENT` keys | ~10-30 |
| `app.jsx` | `CONTENT` let + fallback merge, per-component reads | 20, 275, 294-336, 670-680 |
| `admin.jsx` | Field arrays, `ImageField`, `ContentSettings`, tab wiring | 472-498, 500-558, 560-720, 732, 857-874 |
| `functions/api/upload.js` | Shared image upload used by `ImageField` | full file |
| `functions/api/_auth.js` | `requireAuth` reused for PUT | full file |

## See also / non-goals

- Catalog CRUD (products/categorias/fabricantes) is a separate,
  per-row-table pattern — not covered here, see `[[catalog-crud]]`.
- Auth/session mechanics beyond "call `requireAuth`" — see
  `[[auth-and-sessions]]`.
- Deploy workflow (`deploy.sh`, applying migrations) — see `README.md`.
- User-facing explanation of the three content-override methods — see
  `README.md` (Spanish); this file is the implementation-pattern
  reference, not user docs.
