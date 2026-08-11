// Cloudflare Worker — Gallery Proxy (KV + R2, no CMS)
//
// Each gallery's base image list lives in KV, either seeded via
// PUT /{slug}/images or built up incrementally via POST /{slug}/upload,
// which also stores the file itself in R2. Layout overrides (from the
// ?gedit live editor) live separately in KV so reordering/resizing never
// touches the base image list.
//
// Deploy to Cloudflare Workers with this secret:
//   EDIT_SECRET   — secret key for publish authorization
//
// Usage:
//   GET    /_galleries              — lists known gallery slugs
//   GET    /{gallery-slug}          — returns gallery config (base images + KV layout merged)
//   GET    /{gallery-slug}/img/{filename} — serves an R2-hosted image
//   POST   /{gallery-slug}/upload   — uploads one image to R2 + appends it to the base list
//                                      (requires Authorization: Bearer <secret>, body = raw file
//                                      bytes, header X-Filename = desired filename)
//   DELETE /{gallery-slug}/images/{imageId} — removes one image from the base list + R2
//                                      (requires Authorization: Bearer <secret>)
//   PATCH  /{gallery-slug}/images/{imageId} — updates one image's caption
//                                      (requires Authorization: Bearer <secret>, body = { caption })
//   PUT    /{gallery-slug}          — saves layout to KV (requires Authorization: Bearer <secret>)
//   PUT    /{gallery-slug}/images   — seeds/replaces the base image list in KV (requires Authorization: Bearer <secret>)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    const slug = parts[0];
    const subresource = parts[1];

    // CORS headers for iframe/cross-origin access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Filename",
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

    // ── GET: List known galleries ──
    if (request.method === "GET" && slug === "_galleries") {
      return handleListGalleries(env, corsHeaders);
    }

    // ── GET: Serve an R2-hosted image ──
    if (request.method === "GET" && subresource === "img") {
      const filename = decodeURIComponent(parts.slice(2).join("/"));
      return handleGetImage(env, slug, filename, corsHeaders);
    }

    // ── POST: Upload an image to R2 + append it to the base list ──
    if (request.method === "POST" && subresource === "upload") {
      return handleUpload(request, env, slug, corsHeaders);
    }

    // ── DELETE: Remove an image from the base list + R2 ──
    if (request.method === "DELETE" && subresource === "images" && parts[2]) {
      return handleDeleteImage(request, env, slug, decodeURIComponent(parts[2]), corsHeaders);
    }

    // ── PATCH: Update one image's caption ──
    if (request.method === "PATCH" && subresource === "images" && parts[2]) {
      return handlePatchImageCaption(request, env, slug, decodeURIComponent(parts[2]), corsHeaders);
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

async function handleListGalleries(env, corsHeaders) {
  const list = await env.GALLERY_KV.list({ prefix: "images:" });
  const slugs = list.keys.map((k) => k.name.slice("images:".length));
  return Response.json({ galleries: slugs }, { headers: corsHeaders });
}

async function handleGetImage(env, slug, filename, corsHeaders) {
  if (!filename) {
    return Response.json({ error: "Missing filename" }, { status: 400, headers: corsHeaders });
  }

  const object = await env.GALLERY_IMAGES.get(slug + "/" + filename);
  if (!object) {
    return Response.json({ error: "Image not found" }, { status: 404, headers: corsHeaders });
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.httpEtag,
    },
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "");
}

async function handleUpload(request, env, slug, corsHeaders) {
  // Validate auth
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== env.EDIT_SECRET) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  const rawFilename = request.headers.get("X-Filename");
  if (!rawFilename) {
    return Response.json(
      { error: "Missing X-Filename header" },
      { status: 400, headers: corsHeaders }
    );
  }
  const filename = sanitizeFilename(rawFilename);

  const bytes = await request.arrayBuffer();
  if (!bytes || bytes.byteLength === 0) {
    return Response.json({ error: "Empty upload body" }, { status: 400, headers: corsHeaders });
  }

  const contentType = request.headers.get("Content-Type") || "application/octet-stream";

  // Store the file in R2
  await env.GALLERY_IMAGES.put(slug + "/" + filename, bytes, {
    httpMetadata: { contentType },
  });

  // Append (or update, if re-uploaded) the image entry in the base list
  const kvBase = await env.GALLERY_KV.get("images:" + slug);
  let base = kvBase ? JSON.parse(kvBase) : { title: slug, subtitle: "", images: [] };

  const origin = new URL(request.url).origin;
  const newEntry = {
    id: filename,
    src: `${origin}/${slug}/img/${encodeURIComponent(filename)}`,
    alt: "", // caption — empty until set via admin.html or the ?gedit editor
    size: 1,
  };

  const existingIndex = base.images.findIndex((img) => img.id === filename);
  if (existingIndex >= 0) {
    base.images[existingIndex] = newEntry;
  } else {
    base.images.push(newEntry);
  }

  await env.GALLERY_KV.put("images:" + slug, JSON.stringify(base));

  return Response.json({ ok: true, image: newEntry }, { headers: corsHeaders });
}

async function handleDeleteImage(request, env, slug, imageId, corsHeaders) {
  // Validate auth
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== env.EDIT_SECRET) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  const kvBase = await env.GALLERY_KV.get("images:" + slug);
  if (!kvBase) {
    return Response.json(
      { error: `Gallery "${slug}" not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  const base = JSON.parse(kvBase);
  const before = base.images.length;
  base.images = base.images.filter((img) => img.id !== imageId);

  if (base.images.length === before) {
    return Response.json(
      { error: `Image "${imageId}" not found in "${slug}"` },
      { status: 404, headers: corsHeaders }
    );
  }

  await env.GALLERY_KV.put("images:" + slug, JSON.stringify(base));

  // Best-effort R2 cleanup — the id doubles as the filename for uploaded images.
  // Seeded (non-R2) galleries have ids that won't match any R2 object; delete is a no-op then.
  await env.GALLERY_IMAGES.delete(slug + "/" + imageId).catch(() => {});

  return Response.json({ ok: true }, { headers: corsHeaders });
}

async function handlePatchImageCaption(request, env, slug, imageId, corsHeaders) {
  // Validate auth
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== env.EDIT_SECRET) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (typeof body.caption !== "string") {
    return Response.json(
      { error: "Body must be an object with a `caption` string" },
      { status: 400, headers: corsHeaders }
    );
  }

  const kvBase = await env.GALLERY_KV.get("images:" + slug);
  if (!kvBase) {
    return Response.json(
      { error: `Gallery "${slug}" not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  const base = JSON.parse(kvBase);
  const image = base.images.find((img) => img.id === imageId);
  if (!image) {
    return Response.json(
      { error: `Image "${imageId}" not found in "${slug}"` },
      { status: 404, headers: corsHeaders }
    );
  }

  image.alt = body.caption;
  await env.GALLERY_KV.put("images:" + slug, JSON.stringify(base));

  return Response.json({ ok: true, image }, { headers: corsHeaders });
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
