-- Migration number: 0002 	 2026-09-02T00:00:00.000Z
--
-- Adds a single-row settings table for the site's non-catalog content
-- (store name, hero/footer copy, testimonials, social links, non-catalog
-- images), managed from /admin instead of the gitignored
-- default-content-prod.js file. Stored as one JSON blob per row (id = 1)
-- since it's one object, not a list of independent items.

CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL
);
