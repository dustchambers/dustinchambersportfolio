// Cloudflare Worker — Gallery Proxy (KV-backed, no CMS)
//
// Each gallery's base image list lives in KV, seeded via PUT /{slug}/images.
// Layout overrides (from the ?gedit live editor) live separately in KV so
// reordering/resizing never touches the base image list.
//
// Deploy to Cloudflare Workers with this secret:
//   EDIT_SECRET   — secret key for publish authorization
//
// Usage:
//   GET  /{gallery-slug}          — returns gallery config (base images + KV layout merged)
//   PUT  /{gallery-slug}          — saves layout to KV (requires Authorization: Bearer <secret>)
//   PUT  /{gallery-slug}/images   — seeds/replaces the base image list in KV (requires Authorization: Bearer <secret>)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    const slug = parts[0];
    const subresource = parts[1];

    // CORS headers for iframe/cross-origin access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!slug) {
      return Response.json(
        { error: "Usage: GET /{gallery-slug} or PUT /{gallery-slug}" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── PUT: Seed/replace the base image list in KV ──
    if (request.method === "PUT" && subresource === "images") {
      return handlePutImages(request, env, slug, corsHeaders);
    }

    // ── PUT: Save layout to KV ──
    if (request.method === "PUT") {
      return handlePut(request, env, slug, corsHeaders);
    }

    // ── GET: Fetch gallery config (with KV layout merge) ──
    if (request.method === "GET") {
      return handleGet(env, slug, corsHeaders);
    }

    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  },
};

async function handlePut(request, env, slug, corsHeaders) {
  // Validate auth
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== env.EDIT_SECRET) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  // Read and validate body
  let layout;
  try {
    layout = await request.json();
  } catch (e) {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!Array.isArray(layout)) {
    return Response.json(
      { error: "Body must be a JSON array" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Write to KV
  await env.GALLERY_KV.put("layout:" + slug, JSON.stringify(layout));

  return Response.json(
    { ok: true },
    { headers: corsHeaders }
  );
}

async function handlePutImages(request, env, slug, corsHeaders) {
  // Validate auth
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== env.EDIT_SECRET) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  // Read and validate body: { title?, subtitle?, images: [{ id, src, alt, size }] }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body || !Array.isArray(body.images)) {
    return Response.json(
      { error: "Body must be an object with an `images` array" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Write to KV
  await env.GALLERY_KV.put(
    "images:" + slug,
    JSON.stringify({
      title: body.title || slug,
      subtitle: body.subtitle || "",
      images: body.images,
    })
  );

  return Response.json(
    { ok: true },
    { headers: corsHeaders }
  );
}

async function handleGet(env, slug, corsHeaders) {
  const kvBase = await env.GALLERY_KV.get("images:" + slug);
  if (!kvBase) {
    return Response.json(
      { error: `Gallery "${slug}" not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  let base;
  try {
    base = JSON.parse(kvBase);
  } catch (e) {
    return Response.json(
      { error: "Corrupt KV base image list for \"" + slug + "\": " + e.message },
      { status: 500, headers: corsHeaders }
    );
  }

  let images = base.images;

  // ── Merge KV layout overrides ──
  const savedLayout = await env.GALLERY_KV.get("layout:" + slug);
  if (savedLayout) {
    try {
      const layout = JSON.parse(savedLayout);
      images = mergeLayout(images, layout);
    } catch (e) {
      console.error("Failed to parse saved layout:", e);
    }
  }

  const config = {
    id: slug,
    title: base.title || slug,
    subtitle: base.subtitle || "",
    images: images,
  };

  return Response.json(config, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}

function mergeLayout(baseImages, layout) {
  const baseMap = {};
  baseImages.forEach(function (img) {
    baseMap[img.id] = img;
  });

  const merged = [];
  const usedIds = {};

  layout.forEach(function (entry) {
    // Spacer entries have no base-image equivalent — pass through as-is
    if (entry.type === "spacer") {
      merged.push(entry);
      return;
    }

    const baseImg = baseMap[entry.id];
    if (!baseImg) return; // image removed from base list — skip

    // src and alt always come from the base list (authoritative URLs)
    // all layout overrides (position, size, adjustments, crop) come from KV
    merged.push({
      id:          baseImg.id,
      src:         baseImg.src,
      alt:         baseImg.alt,
      size:        entry.size        !== undefined ? entry.size        : baseImg.size,
      crop:        entry.crop        != null ? entry.crop        : undefined,
      colStart:    entry.colStart    != null ? entry.colStart    : undefined,
      rowStart:    entry.rowStart    != null ? entry.rowStart    : undefined,
      cols:        entry.cols        != null ? entry.cols        : undefined,
      rows:        entry.rows        != null ? entry.rows        : undefined,
      adjustments: entry.adjustments != null ? entry.adjustments : undefined,
    });

    usedIds[entry.id] = true;
  });

  // Append new base images not present in the saved layout
  baseImages.forEach(function (img) {
    if (!usedIds[img.id]) {
      merged.push(img);
    }
  });

  return merged;
}
