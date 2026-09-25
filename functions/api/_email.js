// Order confirmation emails via Resend. Underscore-prefixed like
// _auth.js/_payments.js/_lookup.js so Pages' file-based router doesn't
// expose this as a route. Plain `fetch` against Resend's REST API — no
// Node SDK, matching how this repo already talks to Stripe.

import { formatCantidadUnidad, formatLineName } from "./checkout/create.js";

const FALLBACK_PICKUP = {
  direccion: "Consulta nuestra dirección en la tienda.",
  horario: "Consulta nuestro horario en la tienda.",
};

// POSTs to Resend's /emails endpoint. Throws on failure — this module
// doesn't swallow errors, the caller (webhook.js) decides whether/how to
// isolate that failure from the rest of its own flow.
export async function sendEmail(env, { to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend respondio ${res.status}: ${detail}`);
  }

  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function formatCurrency(amount, currency) {
  const n = Number(amount) || 0;
  return `$${n.toFixed(2)} ${String(currency || "MXN").toUpperCase()}`;
}

function formatDate(createdAt) {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
}

// Itemized order table. Inline style="..." attributes, not Tailwind
// classes — email clients don't execute Tailwind's CDN JS, this is a real
// constraint the rest of the codebase doesn't have.
export function buildOrderItemsHtml(items) {
  const rows = (items || [])
    .map((item) => {
      const name = escapeHtml(
        item.color_nombre
          ? `${item.product_nombre} - ${item.color_nombre}`
          : item.product_nombre
      );
      const cantidad = escapeHtml(formatCantidadUnidad(item.cantidad, item.unidad_precio));
      const subtotal = escapeHtml(formatCurrency(item.subtotal, "MXN"));
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5ddd0;font-family:sans-serif;font-size:14px;color:#3a2f28;">${name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5ddd0;font-family:sans-serif;font-size:14px;color:#3a2f28;text-align:right;">${cantidad}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5ddd0;font-family:sans-serif;font-size:14px;color:#3a2f28;text-align:right;">${subtotal}</td>
        </tr>`;
    })
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr>
          <th style="padding:8px 12px;text-align:left;font-family:sans-serif;font-size:12px;color:#7a6a5a;text-transform:uppercase;">Producto</th>
          <th style="padding:8px 12px;text-align:right;font-family:sans-serif;font-size:12px;color:#7a6a5a;text-transform:uppercase;">Cantidad</th>
          <th style="padding:8px 12px;text-align:right;font-family:sans-serif;font-size:12px;color:#7a6a5a;text-transform:uppercase;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// Customer-facing confirmation: order id/date, itemized table, total, plus
// the Feature A pickup line (pickup.direccion/pickup.horario, falling back
// to a generic string if either is missing).
export function buildCustomerEmailHtml({ order, items, pickup }) {
  const direccion = escapeHtml((pickup && pickup.direccion) || FALLBACK_PICKUP.direccion);
  const horario = escapeHtml((pickup && pickup.horario) || FALLBACK_PICKUP.horario);

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#3a2f28;">
      <h1 style="font-size:20px;margin-bottom:4px;">¡Gracias por tu compra!</h1>
      <p style="font-size:14px;color:#7a6a5a;margin-top:0;">
        Pedido #${escapeHtml(order.id)} &middot; ${escapeHtml(formatDate(order.created_at))}
      </p>
      ${buildOrderItemsHtml(items)}
      <p style="font-size:16px;font-weight:600;text-align:right;margin:16px 0;">
        Total: ${escapeHtml(formatCurrency(order.total, order.currency))}
      </p>
      <div style="margin-top:24px;padding:16px;background:#f6f1e7;border-radius:8px;">
        <p style="font-size:14px;font-weight:600;margin:0 0 4px 0;">Recoge tu pedido en tienda</p>
        <p style="font-size:13px;color:#7a6a5a;margin:0;">${direccion}</p>
        <p style="font-size:13px;color:#7a6a5a;margin:0;">${horario}</p>
      </div>
    </div>`;
}

// Owner-facing summary: order id/date, customer contact info, itemized
// table, total. No pickup line — the shop owner doesn't need reminding of
// their own address.
export function buildAdminEmailHtml({ order, items }) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#3a2f28;">
      <h1 style="font-size:20px;margin-bottom:4px;">Nuevo pedido pagado</h1>
      <p style="font-size:14px;color:#7a6a5a;margin-top:0;">
        Pedido #${escapeHtml(order.id)} &middot; ${escapeHtml(formatDate(order.created_at))}
      </p>
      <p style="font-size:14px;margin:12px 0 0 0;"><strong>Cliente:</strong> ${escapeHtml(order.customer_name)}</p>
      <p style="font-size:14px;margin:4px 0;"><strong>Correo:</strong> ${escapeHtml(order.customer_email)}</p>
      <p style="font-size:14px;margin:4px 0 12px 0;"><strong>Teléfono:</strong> ${escapeHtml(order.customer_phone || "-")}</p>
      ${buildOrderItemsHtml(items)}
      <p style="font-size:16px;font-weight:600;text-align:right;margin:16px 0;">
        Total: ${escapeHtml(formatCurrency(order.total, order.currency))}
      </p>
    </div>`;
}

// Reads footerDireccion/footerHorario straight from D1's site_content row
// (same table functions/api/content.js reads) — the webhook runs in the
// Workers runtime, not the browser, so it cannot reach CONTENT.* the way
// app.jsx does client-side. Wrapped in its own try/catch with the generic
// fallback if the row is missing/malformed.
async function loadPickupInfo(env) {
  try {
    const row = await env.DB.prepare("SELECT content FROM site_content WHERE id = ?").bind(1).first();
    if (!row || !row.content) return FALLBACK_PICKUP;
    const content = JSON.parse(row.content);
    return {
      direccion: content.footerDireccion || FALLBACK_PICKUP.direccion,
      horario: content.footerHorario || FALLBACK_PICKUP.horario,
    };
  } catch {
    return FALLBACK_PICKUP;
  }
}

// Orchestrator: sends both the customer and admin emails via
// Promise.allSettled (not Promise.all) so one failing (e.g. a bad
// customer_email) doesn't suppress the other.
export async function sendOrderConfirmationEmails(env, { order, items }) {
  const pickup = await loadPickupInfo(env);

  const results = await Promise.allSettled([
    sendEmail(env, {
      to: order.customer_email,
      subject: `Confirmación de tu pedido #${order.id} — La Casita del Estambre`,
      html: buildCustomerEmailHtml({ order, items, pickup }),
    }),
    sendEmail(env, {
      to: env.ADMIN_NOTIFICATION_EMAIL,
      subject: `Nuevo pedido pagado #${order.id}`,
      html: buildAdminEmailHtml({ order, items }),
    }),
  ]);

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} de 2 correos de confirmacion fallaron: ${failed
        .map((r) => r.reason && r.reason.message)
        .join("; ")}`
    );
  }
}
