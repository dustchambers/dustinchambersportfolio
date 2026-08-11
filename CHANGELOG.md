# Changelog

## 2026-08-10 (2)

- User reported scrolling inside the gallery embed felt clunky — scroll was getting captured by the iframe's own internal scroll instead of always moving the real page. Cause: `body { overflow-y: auto }` was unconditional, so any brief mismatch between the iframe's synced height and actual content (a late-loading image, a timing gap before the resize postMessage lands) let the iframe's body become internally scrollable and grab the wheel/trackpad event before releasing it back to the parent. Disabled internal scrolling for embedded view (`body.embedded:not(.edit-mode) { overflow-y: hidden }`), keeping it only for the `?gedit` editor, which genuinely needs body as the scroll container for its position:fixed toolbar. Verified via a local same-origin iframe test that scroll now passes straight through to the parent page.

## 2026-08-10

- User hit a real bug: dragging 32 photos into `admin.html` at once for a new `death-and-granite` gallery only resulted in 21 showing up. Root cause: the Worker's upload endpoint does a read-modify-write on the gallery's image list (fetch current list, append, save) — firing many uploads in parallel let concurrent requests read the list at the same time and overwrite each other's addition on save, silently dropping entries even though the files themselves landed fine in R2 (confirmed: all 11 "missing" files were already in R2, just absent from the list). Fixed `admin.html` to upload strictly one file at a time instead of all at once, which serializes those read-modify-writes and eliminates the race. Recovered the 11 lost entries for `death-and-granite` directly (no re-upload needed, since the files already existed).
- Same race applies to deletes (also read-modify-write). Added multi-select to `admin.html` (click a photo to select, "Delete Selected" button) and made batch deletes sequential too, for the same reason.

## 2026-08-06 (3)

- User reported margin still visible on `dustinchambersphoto.com/soma` after the outer-padding fix. Root cause was different from what I'd fixed: not CSS, but a saved KV layout row (`soma-1` + `soma-19`, plus an orphaned 3-col spacer) sized to only span columns 1–15 of the 18-column grid, leaving 3 empty columns on the right and a spacer-shaped gap on the left. Likely left over from an earlier `?gedit` session. Rebuilt the layout from the merged config with that row corrected to a proper 9+9 full-width split (matching the pattern already used elsewhere in the same gallery) and the spacer dropped. Confirmed fixed live.
- `wrangler kv key get` 401'd against the real namespace (the OAuth token appears to have `workers_kv` write-only, no read) — list/delete/put all still work. Worked around it by using the Worker's own merged GET response as the source of truth instead of trying to read the raw KV value directly.
- Noticed while investigating: only 34 of the original 39 `soma-*` images are present in the current layout (`soma-10`, `-12`, `-20`, `-21`, `-37` missing) — most likely removed intentionally via admin.html's delete button, not a bug, but flagging since it wasn't something I removed.

## 2026-08-06 (2)

- Removed the outer padding around the gallery grid (`.gallery`'s side/bottom padding, plus a 12px top padding used only in embedded/iframe view) — it was showing as a visible cream-colored margin around the whole gallery frame. Grid now runs edge-to-edge.
- That padding was baked into the square-cell sizing math in four places: the CSS row-height formula, the edit-mode grid-overlay background size, and two JS functions (`getGridMetrics`'s colWidth calc, and `clientToGridCell`, which explicitly subtracted a gap for the old left padding). Updated all four to match — verified `?gedit` drag/drop still lands exactly where dropped.
- Second push in a row where the Actions deploy didn't auto-trigger on `git push` — same one-off miss as before, not a config issue (manual `gh workflow run "Deploy Pages"` unblocked it both times). Worth a closer look if it becomes a pattern rather than an occasional miss.
- Rewrote `README.md` to be a short, minimal step list. Moved the full embed `<script>`/`<iframe>` snippet out into its own `embed-template.html` file so the README doesn't have ~80 lines of code in the middle of it.
- Added a standing instruction (saved to memory) to log every action taken in a project's `CHANGELOG.md`, not just narrate it in chat.

## 2026-08-06

- Created this repo (`dustinchambersportfolio`) as a standalone project, separate from `lot43imagegallery` — no shared Webflow CMS, Worker, or KV with the Lot43 client work.
- Deployed a dedicated Cloudflare Worker (`dustinchambersportfolio-gallery`) with its own KV namespace — serves gallery configs, no Webflow dependency.
- Set up GitHub Pages for the repo, initially on the legacy build pipeline.
- Added the `tearsheets` test gallery (later retired), then `soma` (39 photos) and `portraits` (32 photos) as the real galleries.
- Added `worker/sync-gallery.js` so adding/removing photos didn't need a manual `curl` call — pointed it at an `images/<slug>/` folder and it updated the Worker.
- Retired the `tearsheets` test gallery (images + KV entry removed) once soma/portraits were live.
- Enabled Cloudflare R2 on the account; added an R2 bucket (`dustinchambersportfolio-gallery-images`) bound to the Worker.
- Extended the Worker with `POST /{slug}/upload`, `DELETE /{slug}/images/{id}`, `GET /{slug}/img/{filename}`, and `GET /_galleries` — image upload/delete/serve, no git required.
- Built `admin.html`: a password-gated (editor key, not a real login) drag-and-drop page wrapping those endpoints, so adding/removing gallery photos no longer needs git or a terminal.
- Wrote `README.md` covering the end-to-end process for adding a new gallery (admin.html + the embed snippet for SoloFolio).
- GitHub Pages' legacy build pipeline started hanging/erroring on pushes (likely repo size — ~250MB of images) with no useful error detail. Switched Pages to Actions-based deployment (`build_type: workflow`) and added `.github/workflows/pages.yml` using `actions/deploy-pages`. Confirmed working and much faster (~1 min vs. hanging indefinitely).
- Diagnosed slow gallery load times: original images were full-resolution export JPEGs (2–4MB each, ~2000×3000px, ~224MB total across soma + portraits). Recompressed all 71 images in place to a 2000px max dimension at JPEG quality 80 (soma 98MB→38MB, portraits 126MB→17MB, ~75% total reduction), with no visible quality loss at gallery/lightbox display sizes. User will export future uploads pre-sized rather than relying on server-side compression.
- One push (`f5c6f71`, the image recompression commit) didn't auto-trigger the Actions deploy — a one-off GitHub-side miss, not a config problem (confirmed by the previous push triggering normally). Deployed manually via `gh workflow run`; noted `gh workflow run "Deploy Pages"` as the fallback if it recurs.
