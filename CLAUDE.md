# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Punto y Lana — a yarn/crochet-supplies storefront. Plain HTML5 + React 18 +
Tailwind CSS, all loaded via CDN — **there is no build step**. `app.jsx` and
`admin.jsx` are JSX files transformed in-browser by Babel standalone (loaded
from `index.html`/`admin.html`), so edits take effect on page reload with no
compile/bundle command. `package.json` only pins the `wrangler` dev
dependency; there is no `npm run build`/`lint`/`test` — there is no test
suite in this repo.

## Commands

Local preview (static-only, catalog from `catalog.csv`, no admin API):
```bash
python3 -m http.server 8000   # serves the repo root; opening index.html via file:// breaks fetch()
```

Local preview with the full Pages Functions + D1 API (admin panel, `/api/*`
routes):
```bash
wrangler d1 execute punto-y-lana --local --file=schema.sql   # first time only, seeds local D1
wrangler pages dev .
```
- Do **not** add `--d1=DB=punto-y-lana` to `wrangler pages dev` — it points
  the Function at a different local sqlite file than the one
  `wrangler d1 execute --local` just seeded, and `/api/products` fails with
  `no such table: products`. Let it resolve the `DB` binding from
  `wrangler.toml` instead.
- Requires a `.dev.vars` file (gitignored, must be recreated per
  clone/checkout) with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` —
  without it, login silently rejects every credential because none are
  configured.

Deploy:
```bash
./deploy.sh              # always use this, never `wrangler pages deploy .`
./deploy.sh --branch=main   # accepts the same flags as `wrangler pages deploy`
```
`wrangler pages deploy .` uploads everything on disk regardless of
`.gitignore` (`.dev.vars`, `backup/*.sql`, `wrangler.toml` would become
publicly fetchable at `<site>/.dev.vars` etc.). `deploy.sh` copies only the
files the live site needs into a temp dir first, and refuses to run if
`config.js` or `default-content-prod.js` is missing.

D1 schema changes on a database that already has data — use migrations, not
`schema.sql` (which is fresh-install only):
```bash
wrangler d1 migrations apply punto-y-lana --local
wrangler d1 migrations apply punto-y-lana --remote   # backup first: wrangler d1 export punto-y-lana --remote --output backup.sql
```
New migration files go in `migrations/000N_*.sql`.

## Architecture

**Request layer**: Cloudflare Pages Functions under `functions/api/`
(file-based routing: `products.js` → `/api/products`,
`products/[id].js` → `/api/products/:id`). Bindings come from
`wrangler.toml`: D1 as `env.DB`, R2 bucket `casita-inventory` as
`env.IMAGES` (+ `R2_PUBLIC_URL` var for constructing public image URLs).

**Auth**: single hardcoded admin account (`ADMIN_USERNAME`/`ADMIN_PASSWORD`
secrets), no user table. `functions/api/_auth.js` issues an HMAC-signed,
`HttpOnly`/`Secure` session cookie on login; every write handler
(`POST`/`PUT`/`DELETE`) calls `requireAuth(request, env)` as its first line.
`admin.html` isn't linked from public nav but that's not the protection —
the cookie check on writes is. GET endpoints are intentionally public
(the storefront reads through the same API).

**Catalog data model**: `products` table with FK columns `fabricante_id`/
`categoria_id` into lookup tables `fabricantes`/`categorias`
(migration `0001_add_fabricante_categoria_lookup_tables.sql`).
`functions/api/_lookup.js` is a factory (`createLookupHandlers`,
`createLookupItemHandlers`) shared by `categorias.js`/`categorias/[id].js`
and `fabricantes.js`/`fabricantes/[id].js` — find-or-create on POST (blocks
duplicate rows via a normalized-name column), rename on PUT, delete on
DELETE but only if no product still references the row.

**Image upload**: `functions/api/upload.js` — auth-gated, validates MIME
type + 5MB max, writes to R2 under a `products/<uuid>.<ext>` key (this
prefix is used for *all* uploads, including non-product images — a known
wart, not something to silently "fix" mid-task), returns the public URL.
Reused by both the product-image field and the site-content image fields in
admin.

**Site content (copy + non-catalog images)**: layered fallback chain, in
order — `default-content.js` (demo copy, tracked) →
`default-content-prod.js` (real copy, gitignored) → `config.js`'s `CONTENT`
override (gitignored) → D1 `site_content` row (single JSON-blob row,
`id = 1`, fetched via `GET /api/content`, editable from admin's "Contenido
del sitio" tab, upserted via `PUT /api/content`). Full pattern, checklists
for adding a new field/image slot, and file:line references are documented
in `.claude/skills/site-content-and-images/SKILL.md` — read that before
touching this system.

**Catalog data source switch**: `config.js`'s `API_BASE` decides whether
`app.jsx`/`admin.html` talk to the D1-backed API (`API_BASE` set, even to
`""` for same-origin) or fall back to static `catalog.csv` (`API_BASE`
unset/`null`). Use `API_BASE: ""` for same-origin — a full deployment URL
gets CORS-blocked because each deploy generates a different hash subdomain.

**Local vs. remote D1/R2**: `wrangler pages dev` emulates both on disk
(`.wrangler/state`) separately from the remote resources — an R2 upload
works locally but the returned `pub-*.r2.dev` URL won't resolve until you
deploy, same idea as local vs. remote D1 needing separate seeding/migration
runs.
