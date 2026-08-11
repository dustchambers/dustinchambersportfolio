# Adding a Gallery

**1. Add photos** — [admin.html](https://dustchambers.github.io/dustinchambersportfolio/admin.html), key `dcp-editor-2026`, create or pick a gallery, drag photos in.

**2. Add it to the site** — copy [embed-template.html](embed-template.html), swap `YOUR-GALLERY-NAME` for the gallery's name, paste into that SoloFolio page's "HTML (inserted above content)" field.

Done. No terminal needed.

---

- **Rearrange photos:** add `&gedit` to the gallery's URL, drag to move/resize, click Publish.
- **Remove a gallery entirely:** ask — quick one-line fix.

## Iterating on the design later

Everything — grid layout, spacing, the editor, uploads, the lightbox — loads fresh from GitHub Pages on every page view (`gallery9.html`/`.js`/`.css` inside the iframe, `embed.js` for the lightbox in the parent page). Fixes and design changes to any of that just work once pushed — usually within about 5-10 minutes for the browser's/GitHub's caching to catch up, no SoloFolio involvement.

**Step 2 above is the only reason to ever touch SoloFolio** — adding a brand new gallery to a new page. Nothing about improving an *existing* gallery's look or behavior should require pasting anything into SoloFolio again.
