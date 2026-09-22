// Minimal Cloudflare Worker — its only job is to call
// POST /api/checkout/poll on a schedule (every 5 minutes, see wrangler.toml's
// [triggers] crons). Cloudflare Pages Functions have no Cron Trigger
// support, so this lives as a separate, independently-deployed plain
// Workers project (not Pages) per Cloudflare's documented pattern for this
// exact situation. All real confirmation logic lives in the Pages
// Function (functions/api/checkout/poll.js) — this file stays tiny.

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollCheckout(env));
  },
};

async function pollCheckout(env) {
  try {
    const res = await fetch("https://punto-y-lana.pages.dev/api/checkout/poll", {
      method: "POST",
      headers: { "X-Poll-Secret": env.POLL_SECRET },
    });
    const body = await res.text();
    if (res.ok) {
      console.log("checkout poll ok:", res.status, body);
    } else {
      console.error("checkout poll failed:", res.status, body);
    }
  } catch (err) {
    console.error("checkout poll fetch threw:", err);
  }
}
