// Gallery embed loader — dustinchambersportfolio
//
// This is the ONLY thing that needs to be pasted into a SoloFolio page's
// "HTML (inserted above content)" field:
//
//   <script src="https://dustchambers.github.io/dustinchambersportfolio/embed.js" data-gallery-id="YOUR-GALLERY-NAME"></script>
//
// Everything else (grid, editor, uploads, and this lightbox) is loaded
// fresh from GitHub Pages on every page view, so fixes here take effect
// automatically — no re-pasting into SoloFolio required, ever, for
// anything covered by this file or by gallery9.html/js/css.
//
// The lightbox specifically has to live in the PARENT page (not inside
// the gallery iframe) because position:fixed doesn't anchor to the real
// viewport from within a cross-origin iframe — that's the one thing that
// can't just live inside gallery9.js.

(function () {
  "use strict";

  var thisScript = document.currentScript;
  var galleryId = thisScript.dataset.galleryId;
  if (!galleryId) {
    console.error("embed.js: missing data-gallery-id on the <script> tag");
    return;
  }

  var uid = "g9-" + Math.random().toString(36).slice(2, 9);

  var wrapper = document.createElement("div");
  wrapper.id = uid + "-wrapper";
  wrapper.style.width = "100%";

  var iframe = document.createElement("iframe");
  iframe.id = uid;
  iframe.style.cssText = "width:100%;border:none;height:0;display:block";
  wrapper.appendChild(iframe);

  thisScript.parentNode.insertBefore(wrapper, thisScript.nextSibling);

  var iframeSrc = "https://dustchambers.github.io/dustinchambersportfolio/gallery9.html?id=" + encodeURIComponent(galleryId);
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
    lbEl.id = uid + "-lb-overlay";
    lbEl.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(26,26,26,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.3s;pointer-events:none";
    lbEl.innerHTML =
      '<button id="' + uid + '-lb-close" style="position:absolute;top:2rem;right:2.5rem;background:none;border:none;color:#EDEBE0;font-size:2.2rem;cursor:pointer;opacity:0.6;z-index:1002">&times;</button>' +
      '<button id="' + uid + '-lb-prev" style="position:absolute;left:0;top:0;width:12.5%;height:100%;background:none;border:none;color:#EDEBE0;font-size:3rem;cursor:pointer;opacity:0.3;z-index:1001;display:flex;align-items:center;justify-content:center">&#8249;</button>' +
      '<button id="' + uid + '-lb-next" style="position:absolute;right:0;top:0;width:12.5%;height:100%;background:none;border:none;color:#EDEBE0;font-size:3rem;cursor:pointer;opacity:0.3;z-index:1001;display:flex;align-items:center;justify-content:center">&#8250;</button>' +
      '<div id="' + uid + '-lb-content" style="display:flex;flex-direction:column;align-items:center;max-width:90vw;max-height:90vh">' +
        '<img id="' + uid + '-lb-img" style="max-width:90vw;max-height:78vh;object-fit:contain;border-radius:2px">' +
        '<p id="' + uid + '-lb-caption" style="margin:1.1rem 0 0;font-family:Inconsolata,monospace;font-size:0.95rem;color:rgba(232,228,223,0.6);letter-spacing:0.1em;text-transform:uppercase;text-align:center"></p>' +
        '<span id="' + uid + '-lb-counter" style="margin-top:0.6rem;font-family:Inconsolata,monospace;font-size:0.8rem;color:rgba(232,228,223,0.4);letter-spacing:0.15em"></span>' +
      '</div>';
    document.body.appendChild(lbEl);
    document.getElementById(uid + "-lb-close").onclick = closeLb;
    document.getElementById(uid + "-lb-prev").onclick = function() { showLb(lbIndex - 1); };
    document.getElementById(uid + "-lb-next").onclick = function() { showLb(lbIndex + 1); };
    lbEl.onclick = function(ev) { if (ev.target === lbEl) closeLb(); };
  }

  function showLb(i) {
    if (!lbEl) buildLightbox();
    lbIndex = (i + lbImages.length) % lbImages.length;
    var img = lbImages[lbIndex];
    document.getElementById(uid + "-lb-img").src = img.src;
    document.getElementById(uid + "-lb-img").alt = img.alt;
    var captionEl = document.getElementById(uid + "-lb-caption");
    captionEl.textContent = img.alt || "";
    captionEl.style.display = img.alt ? "block" : "none";
    document.getElementById(uid + "-lb-counter").textContent = (lbIndex + 1) + " / " + lbImages.length;
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
    if (!e.data || e.source !== iframe.contentWindow) return;
    if (e.data.type === "resize") {
      iframe.style.height = e.data.height + "px";
    }
    if (e.data.type === "lightbox") {
      lbImages = e.data.images;
      showLb(e.data.index);
    }
  });
})();
