// Copy this file to config.js and adjust for your environment.
// config.js is gitignored, so production values never enter the repo.
// If config.js is absent (e.g. this demo), app.jsx falls back to catalog.csv.
window.APP_CONFIG = {
  CATALOG_URL: "catalog.csv",
  // Set API_BASE (e.g. "" for same-origin, or a full URL) to load the
  // catalog from the Cloudflare Pages Functions API instead of catalog.csv,
  // and to enable admin.html. Leave as null to keep using catalog.csv.
  API_BASE: null,
};
