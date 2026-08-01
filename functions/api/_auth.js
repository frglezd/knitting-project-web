const COOKIE_NAME = "pyl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), part.slice(idx + 1)];
      })
  );
}

export async function createSessionCookie(env) {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expires}`;
  const signature = await hmacHex(env.SESSION_SECRET, payload);
  const value = `${payload}.${signature}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAuthenticated(request, env) {
  const cookies = parseCookies(request);
  const value = cookies[COOKIE_NAME];
  if (!value) return false;

  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const payload = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const expected = await hmacHex(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(signature, expected)) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && Date.now() <= expires;
}

export async function requireAuth(request, env) {
  const ok = await isAuthenticated(request, env);
  if (ok) return null;
  return new Response(JSON.stringify({ error: "No autorizado" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function checkCredentials(env, username, password) {
  if (!username || !password) return false;
  return (
    timingSafeEqual(username, env.ADMIN_USERNAME || "") &&
    timingSafeEqual(password, env.ADMIN_PASSWORD || "")
  );
}
