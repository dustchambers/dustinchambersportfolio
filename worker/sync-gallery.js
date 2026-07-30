#!/usr/bin/env node
// Sync a gallery's image list to the Worker from a local images/<slug>/ folder.
//
// Usage:
//   EDIT_SECRET=dcp-editor-2026 node worker/sync-gallery.js <slug> ["Title"] ["Subtitle"]
//
// What it does:
//   1. Reads every image file in images/<slug>/ (relative to the repo root)
//   2. Builds the gallery's base image list from that folder — add or delete
//      files there to change what's in the gallery
//   3. PUTs it to the Worker at PUT /<slug>/images
//
// Run `git add`, `git commit`, and `git push` yourself first (or after) so the
// image files are actually reachable at their GitHub Pages URLs — this script
// only updates the Worker's list, it doesn't touch git.

const fs = require("fs");
const path = require("path");

const WORKER_URL = "https://dustinchambersportfolio-gallery.dustintchambers.workers.dev";
const PAGES_BASE = "https://dustchambers.github.io/dustinchambersportfolio";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const [, , slug, title, subtitle] = process.argv;

if (!slug) {
  console.error("Usage: node worker/sync-gallery.js <slug> [\"Title\"] [\"Subtitle\"]");
  process.exit(1);
}

const secret = process.env.EDIT_SECRET;
if (!secret) {
  console.error("Set EDIT_SECRET in your environment, e.g.:");
  console.error('  EDIT_SECRET=dcp-editor-2026 node worker/sync-gallery.js ' + slug);
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const imagesDir = path.join(repoRoot, "images", slug);

if (!fs.existsSync(imagesDir)) {
  console.error("No such folder: " + imagesDir);
  process.exit(1);
}

const files = fs
  .readdirSync(imagesDir)
  .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error("No image files found in " + imagesDir);
  process.exit(1);
}

const galleryTitle = title || slug;
const images = files.map((filename) => ({
  id: path.parse(filename).name,
  src: `${PAGES_BASE}/images/${slug}/${filename}`,
  alt: galleryTitle,
  size: 1,
}));

const payload = {
  title: galleryTitle,
  subtitle: subtitle || "",
  images,
};

console.log(`Syncing ${images.length} image(s) for "${slug}"...`);

fetch(`${WORKER_URL}/${encodeURIComponent(slug)}/images`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const body = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(body));
    console.log("Done:", body);
    console.log(`View: ${PAGES_BASE}/gallery9.html?id=${slug}`);
  })
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
