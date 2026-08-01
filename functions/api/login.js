import { createSessionCookie, checkCredentials } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = body || {};
  if (!checkCredentials(env, username, password)) {
    return new Response(JSON.stringify({ error: "Usuario o contrasena incorrectos" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cookie = await createSessionCookie(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}
