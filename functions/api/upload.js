import { requireAuth } from "./_auth.js";

const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function extensionFor(file) {
  const fromName = file.name && file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  return fromName || EXT_BY_TYPE[file.type] || "bin";
}

export async function onRequestPost({ request, env }) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Formulario invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Falta el archivo" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!(file.type in EXT_BY_TYPE)) {
    return new Response(JSON.stringify({ error: "Tipo de archivo no permitido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "El archivo supera 5MB" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = `products/${crypto.randomUUID()}.${extensionFor(file)}`;
  await env.IMAGES.put(key, file, { httpMetadata: { contentType: file.type } });

  return new Response(JSON.stringify({ url: `${env.R2_PUBLIC_URL}/${key}`, key }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
