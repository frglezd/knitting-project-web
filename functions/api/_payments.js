// Stripe webhook signature verification. Mirrors the crypto.subtle
// HMAC-SHA256 pattern already used for session cookies in _auth.js:4-27 —
// duplicated here rather than imported since _auth.js doesn't export those
// helpers and this is a distinct concern (Stripe's signature scheme, not
// our own session cookie format).

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

// Parses a `Stripe-Signature` header of the form
// `t=<unix-timestamp>,v1=<hex-signature>[,v1=<hex-signature>...]` (Stripe
// can send multiple v1 values during secret rotation — any one matching is
// sufficient). Returns { timestamp, signatures } or null if malformed.
function parseSignatureHeader(header) {
  if (!header) return null;
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

// Verifies a Stripe webhook request's signature against the raw request
// body. Must be called with the exact raw body text (before any
// JSON.parse) — see webhook.js. Returns true/false; the caller decides how
// to respond on failure.
export async function verifyStripeSignature(request, rawBody, env) {
  const parsed = parseSignatureHeader(request.headers.get("Stripe-Signature"));
  if (!parsed) return false;
  if (!env.STRIPE_WEBHOOK_SECRET) return false;

  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${parsed.timestamp}.${rawBody}`);
  return parsed.signatures.some((sig) => timingSafeEqual(sig, expected));
}
