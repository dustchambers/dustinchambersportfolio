# Adding a New Gallery

No terminal needed for any of this. Two steps: add the photos, then add the embed code to your SoloFolio page.

## 1. Add the photos

1. Go to **[https://dustchambers.github.io/dustinchambersportfolio/admin.html](https://dustchambers.github.io/dustinchambersportfolio/admin.html)**
2. Enter the editor key: `dcp-editor-2026`
3. Under "or", type a short name for the gallery (letters/numbers/dashes only, e.g. `weddings` or `street-2026`) and click **Create**
4. Drag your photos into the box (or click it to pick files from your computer)
5. Wait for the upload progress to finish — that's it, the photos are live

To edit an **existing** gallery instead of creating a new one, just pick it from the dropdown at the top instead of typing a new name. Click the **×** on any photo to remove it.

## 2. Add it to your SoloFolio page

1. Create (or open) the page on SoloFolio you want the gallery on
2. Find the **"HTML (inserted above content)"** field in the page settings
3. Paste the code below, replacing `YOUR-GALLERY-NAME` (in the one line marked below) with the exact name you used in step 1
4. Save the page

```html
<!-- Gallery embed — dustinchambersportfolio -->
<div id="gallery-wrapper" style="width:100%">
  <iframe
    id="lot43-gallery"
    style="width:100%;border:none;height:0;display:block"
  ></iframe>
</div>

<script>
  var iframe = document.getElementById("lot43-gallery");
  var iframeSrc = "https://dustchambers.github.io/dustinchambersportfolio/gallery9.html?id=YOUR-GALLERY-NAME"; // ← change this
  if (new URLSearchParams(window.location.search).has("gedit")) {
    iframeSrc += "&gedit";
  }
  iframe.src = iframeSrc;

  // ── Lightbox (built in parent so position:fixed works) ──
  var lbImages = [];
  var lbIndex = 0;
  var lbEl = null;

  function buildLightbox() {
    lbEl = document.createElement("div");
    lbEl.id = "lb-overlay";
    lbEl.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(26,26,26,0.95);display:flex;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.3s;pointer-events:none";
    lbEl.innerHTML =
      '<button id="lb-close" style="position:absolute;top:2rem;right:2.5rem;background:none;border:none;color:#EDEBE0;font-size:2.2rem;cursor:pointer;opacity:0.6;z-index:1002">&times;</button>' +
      '<button id="lb-prev" style="position:absolute;left:0;top:0;width:12.5%;height:100%;background:none;border:none;color:#EDEBE0;font-size:3rem;cursor:pointer;opacity:0.3;z-index:1001;display:flex;align-items:center;justify-content:center">&#8249;</button>' +
      '<button id="lb-next" style="position:absolute;right:0;top:0;width:12.5%;height:100%;background:none;border:none;color:#EDEBE0;font-size:3rem;cursor:pointer;opacity:0.3;z-index:1001;display:flex;align-items:center;justify-content:center">&#8250;</button>' +
      '<img id="lb-img" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:2px">' +
      '<p id="lb-caption" style="position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);font-family:Inconsolata,monospace;font-size:0.95rem;color:rgba(232,228,223,0.5);letter-spacing:0.1em;text-transform:uppercase"></p>' +
      '<span id="lb-counter" style="position:absolute;bottom:4.5rem;left:50%;transform:translateX(-50%);font-family:Inconsolata,monospace;font-size:0.85rem;color:rgba(232,228,223,0.4);letter-spacing:0.15em"></span>';
    document.body.appendChild(lbEl);
    document.getElementById("lb-close").onclick = closeLb;
    document.getElementById("lb-prev").onclick = function() { showLb(lbIndex - 1); };
    document.getElementById("lb-next").onclick = function() { showLb(lbIndex + 1); };
    lbEl.onclick = function(ev) { if (ev.target === lbEl) closeLb(); };
  }

  function showLb(i) {
    if (!lbEl) buildLightbox();
    lbIndex = (i + lbImages.length) % lbImages.length;
    var img = lbImages[lbIndex];
    document.getElementById("lb-img").src = img.src;
    document.getElementById("lb-img").alt = img.alt;
    document.getElementById("lb-caption").textContent = img.alt;
    document.getElementById("lb-counter").textContent = (lbIndex + 1) + " / " + lbImages.length;
    lbEl.style.opacity = "1";
    lbEl.style.pointerEvents = "all";
    document.body.style.overflow = "hidden";
    iframe.blur();
    window.focus();
  }

  function closeLb() {
    if (!lbEl) return;
    lbEl.style.opacity = "0";
    lbEl.style.pointerEvents = "none";
    document.body.style.overflow = "";
  }

  document.addEventListener("keydown", function(ev) {
    if (!lbEl || lbEl.style.opacity !== "1") return;
    if (ev.key === "Escape") closeLb();
    if (ev.key === "ArrowLeft") showLb(lbIndex - 1);
    if (ev.key === "ArrowRight") showLb(lbIndex + 1);
  });

  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "resize") {
      iframe.style.height = e.data.height + "px";
    }
    if (e.data && e.data.type === "lightbox") {
      lbImages = e.data.images;
      showLb(e.data.index);
    }
  });
</script>
```

That's the whole thing — every gallery uses this exact same code, only the gallery name in that one marked line changes.

## Rearranging photos (size, order, position)

Once a gallery is live, add `&gedit` to the end of its URL to open the layout editor — for example:

`https://dustchambers.github.io/dustinchambersportfolio/gallery9.html?id=YOUR-GALLERY-NAME&gedit`

Drag to reorder, drag a corner to resize, then click **Publish**. This is separate from adding/removing photos — use `admin.html` for that.

## Notes

- Gallery names can only have letters, numbers, and dashes — the admin page will clean up anything else automatically.
- The editor key (`dcp-editor-2026`) is required both for `admin.html` uploads and for the `gedit` **Publish** button. Treat it like a light lock, not a real password — it's not meant to keep out a determined snoop, just to keep this from being wide open to anyone with the URL.
- If you ever want a gallery gone completely (not just emptied), that still needs a quick assist — ask and it's a one-line fix.
