---
name: auth-and-sessions
description: How the single hardcoded admin account, HMAC session cookie, and requireAuth gate work across functions/api/_auth.js, login.js, logout.js, session.js, and admin.jsx's login screen. Use when adding a new write endpoint, touching login/logout, or changing session behavior.
metadata:
  allowed-tools: Read, Edit, Grep, Glob, Bash
  model: sonnet
---

# Auth & sessions

Reference for the admin auth system. Read this before adding any new
`POST`/`PUT`/`DELETE` API route, or touching login/logout/session
behavior — don't re-derive the cookie scheme or forget the auth gate.

## Architecture at a glance

- **No user table.** A single hardcoded admin account lives in two
  secrets, `ADMIN_USERNAME`/`ADMIN_PASSWORD` (set via `.dev.vars` locally,
  Cloudflare Pages secrets in production). There is no signup, no
  multi-user support, no password hashing — credentials are compared
  directly (see `checkCredentials` below).
- Sessions are a signed, stateless cookie — no server-side session store,
  no D1 table for sessions. Everything needed to validate a session is
  encoded in the cookie itself plus `env.SESSION_SECRET`.
- All auth logic lives in `functions/api/_auth.js` (88 lines, full file).
  Every other file (`login.js`, `logout.js`, `session.js`, and every
  catalog/content write handler) imports from it — never duplicate this
  logic in a new route.

## The session cookie (`functions/api/_auth.js`)

- Cookie name `pyl_session` (line 1), TTL `SESSION_TTL_SECONDS = 8h`
  (line 2).
- `createSessionCookie(env)` (line 43): payload is just the expiry
  timestamp (`Date.now() + TTL`), signed with `HMAC-SHA256` over
  `env.SESSION_SECRET` (`hmacHex`, line 8). Cookie value is
  `"<expiryMs>.<hexSignature>"`. Attributes: `HttpOnly; Secure;
  SameSite=Strict; Max-Age=<TTL>` (line 48) — no JS access, no cross-site
  sends, browser expires it automatically at TTL.
- `isAuthenticated(request, env)` (line 55): parses the cookie, splits on
  the **last** `.` (`lastIndexOf`, line 60 — the signature is hex so it
  can't itself contain a `.`, this is what makes splitting on the last dot
  safe), recomputes the HMAC over the payload and compares with
  `timingSafeEqual` (line 20 — constant-time char-by-char XOR, guards
  against timing attacks on the signature check), then checks
  `Date.now() <= expires`. There is no way to invalidate a session early
  short of rotating `SESSION_SECRET` (which invalidates *all* sessions) —
  logout just clears the cookie client-side (see below), it doesn't
  revoke server-side state, because there isn't any.
- `requireAuth(request, env)` (line 72): the one function every write
  handler calls. Returns `null` if authenticated (caller proceeds),
  otherwise a ready-to-return `401 {"error": "No autorizado"}` Response.
  **The calling convention is `const authError = await requireAuth(...);
  if (authError) return authError;` as the literal first line of the
  handler** — copy this exact pattern for any new write route, don't
  reimplement the check inline.
- `checkCredentials(env, username, password)` (line 81): direct
  `timingSafeEqual` comparison against `env.ADMIN_USERNAME`/
  `ADMIN_PASSWORD` — also constant-time, also guards against a timing
  attack on username/password matching. Returns `false` immediately if
  either input is falsy (line 82), so a missing secret in `.dev.vars`
  means every login attempt is silently rejected, not a crash (see
  CLAUDE.md's dev-setup gotcha).

## Login/logout/session-check endpoints

- `functions/api/login.js` — `POST /api/login`. Parses JSON body,
  `checkCredentials`, on success calls `createSessionCookie(env)` and
  sets it via the `Set-Cookie` response header. No auth required to hit
  this endpoint (it's how you get a session).
- `functions/api/logout.js` — `POST /api/logout`. No auth check, no body
  parsing — just returns `clearSessionCookie()` (line 51-53 of
  `_auth.js`: same cookie name/attributes with `Max-Age=0`) unconditionally.
- `functions/api/session.js` — `GET /api/session`. No auth required
  (it's the check itself) — returns `{ authenticated: boolean }` via
  `isAuthenticated`. This is what `admin.jsx`'s `App()` polls on mount to
  decide whether to show the login screen.

## Admin UI pattern (`admin.jsx`)

- `App()` (`admin.jsx:976-991`) is the top-level gate: state machine
  `"comprobando" | "anonimo" | "autenticado"` (line 977). On mount, if
  `USE_API` (line 980 — no API configured means no auth to check, see
  `NotConfigured`), fetches `/api/session` and sets state from
  `data.authenticated`. Renders `null` while checking (line 988) to avoid
  a login-screen flash before the check resolves.
- `Login` component (`admin.jsx:74-`): plain username/password form,
  posts to `/api/login` with `credentials: "include"` (via the shared
  `api()` helper, `admin.jsx:18-24`), calls `onLoggedIn()` prop on success
  to flip `App()`'s state to `"autenticado"`.
- `AdminApp` (the actual admin panel, catalog + content tabs) only
  renders once `sesion === "autenticado"` (line 990) — it is not itself
  auth-aware; it trusts the gate in `App()`.
- Logout (`admin.jsx:835-837`, `handleLogout`): posts to `/api/logout`
  then `window.location.reload()` — the reload re-runs `App()`'s mount
  check, which will now see the cleared cookie and show `Login` again.
- `admin.html` isn't linked from public nav, **but that is not the
  security boundary** — the cookie check on every write endpoint is. Do
  not treat "not linked in nav" as a substitute for `requireAuth` on a
  new endpoint.

## Checklist: add a new authenticated write endpoint

1. `import { requireAuth } from "./_auth.js";` (adjust relative path for
   nested routes, e.g. `../_auth.js` under `functions/api/<x>/[id].js`).
2. First line of the handler body:
   ```js
   const authError = await requireAuth(request, env);
   if (authError) return authError;
   ```
3. Leave the corresponding `GET` handler (if any) **without** this check
   — GET endpoints in this codebase are intentionally public (the
   storefront reads through the same API). Only add `requireAuth` to
   `POST`/`PUT`/`DELETE`.
4. No client-side change needed beyond using the shared `api()` helper in
   `admin.jsx` (sets `credentials: "include"` so the cookie is sent) —
   don't hand-roll `fetch` for a new admin call.

## Gotchas / known warts

- Session cookies cannot be revoked individually — only rotating
  `SESSION_SECRET` invalidates existing sessions (all of them at once).
  There's no "log out other devices" or per-session tracking.
- `checkCredentials`/`timingSafeEqual` guard against timing attacks but
  there is **no rate limiting** on `/api/login` — brute-forcing the admin
  password is only slowed by network latency. Not something to silently
  "fix" as a drive-by; flag it if asked about hardening.
- Missing `.dev.vars` locally doesn't error — login just always returns
  401, because `checkCredentials` compares against `undefined`/`""` and
  `timingSafeEqual` correctly returns `false`. This is the exact failure
  mode described in CLAUDE.md's local-dev section; if login is silently
  rejecting known-good credentials locally, check `.dev.vars` exists
  before assuming a code bug.
- `GET /api/session` and `GET /api/content` (see
  `[[site-content-and-images]]`) are both intentionally unauthenticated —
  don't add auth to a GET route without checking whether the storefront
  itself depends on it being public first.

## Reference table

| File | Responsibility |
|---|---|
| `functions/api/_auth.js` | Cookie creation/validation, `requireAuth`, `checkCredentials` — full file, 88 lines |
| `functions/api/login.js` | `POST /api/login` |
| `functions/api/logout.js` | `POST /api/logout` |
| `functions/api/session.js` | `GET /api/session` |
| `admin.jsx` | `api()` helper (18-24), `Login` (74-), `App()` gate (976-991), `handleLogout` (835-837) |

## See also / non-goals

- Every catalog write endpoint (`products`, `categorias`, `fabricantes`)
  and the content `PUT` endpoint call `requireAuth` the same way — see
  `[[catalog-crud]]` and `[[site-content-and-images]]` for those specific
  call sites, not duplicated here.
- Image upload auth gating (`functions/api/upload.js`) follows the same
  `requireAuth`-first pattern — see the upload section in
  `[[site-content-and-images]]`.
