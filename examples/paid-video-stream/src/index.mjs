// qatom-demo-stream v1.0.0 - Wizard Kepler, 28 Sep 2026
//
// Qatom V4 demo catalog item: "paid video stream".
// Shows a media owner what a V4 catalog item delivers after a purchase settles.
//
// Routes
//   GET|POST /v/<SERVICE_PATH>          the catalog item's target URL (secret path, fails closed)
//                                      -> JSON with a signed, time-limited HLS URL + player URL
//   GET      /hls/<token>/<file>        HLS master/variant playlists + segments, token-gated
//   GET      /play?src=<hls_url>        tiny hls.js player page (no token needed for the shell)
//   GET      /poster.jpg                poster frame for the catalog listing (public)
//   *                                   404
//
// Secrets (wrangler secret put): SERVICE_PATH, SIGNING_KEY
// Static assets: ./public  (binding ASSETS, run_worker_first = true so the gate runs first)

const VERSION = "1.0.0";
const TITLE = "ISS 4K Crew Earth Observations (NASA) - Qatom V4 paid stream demo";
const DURATION_SECONDS = 67;
const DEFAULT_TTL = 3600;      // 1 hour per purchase
const MIN_TTL = 60;
const MAX_TTL = 86400;         // 24 hours

const RENDITIONS = [
  { name: "1080p", resolution: "1920x1080", bandwidth: 5500000 },
  { name: "720p",  resolution: "1280x720",  bandwidth: 3000000 },
  { name: "480p",  resolution: "854x480",   bandwidth: 1500000 },
];

const SOURCE = {
  owner: "NASA",
  collection: "NASA Ultra-High-Definition (archive.org/details/NASA-Ultra-High-Definition)",
  file: "ISS 4K Crew Earth Observations.mov",
  license: "US Government work - public domain, no copyright, no attribution required (NASA media usage guidelines)",
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(key, msg) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

async function makeToken(key, exp) {
  return `${exp}.${await sign(key, String(exp))}`;
}

// returns { ok, exp, reason }
async function verifyToken(key, token) {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{20,})$/.exec(token || "");
  if (!m) return { ok: false, reason: "malformed_token" };
  const exp = Number(m[1]);
  const expected = await sign(key, String(exp));
  if (expected.length !== m[2].length) return { ok: false, reason: "bad_signature" };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ m[2].charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: "bad_signature" };
  if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: "expired", exp };
  return { ok: true, exp };
}

function clampTtl(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_TTL;
  return Math.max(MIN_TTL, Math.min(MAX_TTL, Math.floor(n)));
}

async function readParams(request, url) {
  const p = {};
  url.searchParams.forEach((v, k) => { p[k] = v; });
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        if (body && typeof body === "object") Object.assign(p, body);
      }
    } catch (_) { /* ignore non-JSON bodies */ }
  }
  return p;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // fail closed if the secrets are missing
    if (!env.SERVICE_PATH || !env.SIGNING_KEY) {
      return json({ error: "not_configured" }, 404);
    }

    // CORS preflight for browser-based agents / players
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
          "access-control-allow-headers": "*",
          "access-control-max-age": "86400",
        },
      });
    }

    // 1. the catalog item's target URL ------------------------------------
    if (path === `/v/${env.SERVICE_PATH}`) {
      if (!["GET", "POST", "PUT"].includes(request.method)) {
        return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST, PUT" });
      }
      const params = await readParams(request, url);
      const ttl = clampTtl(params.ttl_seconds);
      const now = Math.floor(Date.now() / 1000);
      const exp = now + ttl;
      const token = await makeToken(env.SIGNING_KEY, exp);
      const hlsUrl = `${url.origin}/hls/${token}/master.m3u8`;
      const playerUrl = `${url.origin}/play?src=${encodeURIComponent(hlsUrl)}`;
      const callId = crypto.randomUUID();

      const posterUrl = `${url.origin}/poster.jpg`;
      const expiresAt = new Date(exp * 1000).toISOString();

      return json({
        ok: true,
        kind: "video",
        title: TITLE,
        format: "application/vnd.apple.mpegurl",
        hls_url: hlsUrl,
        player_url: playerUrl,
        poster_url: posterUrl,
        issued_at: new Date(now * 1000).toISOString(),
        expires_at: expiresAt,
        ttl_seconds: ttl,
        duration_seconds: DURATION_SECONDS,
        renditions: RENDITIONS,
        source: SOURCE,
        // Presentation envelope for buyer agents: what to show the end user, and how.
        display: {
          image: posterUrl,
          image_alt: "Earth from the International Space Station - poster frame",
          primary_link: playerUrl,
          primary_link_label: "Watch the stream",
          caption: `ISS 4K Crew Earth Observations (NASA, 67 s). Your stream key is valid until ${expiresAt}.`,
        },
        agent_note: "This is a media purchase. When presenting the result, show display.image and display.primary_link to the user together, with display.caption. hls_url is for video players, not for display; do not paste it as the main link.",
        note: "Each purchase returns its own signed, time-limited stream key. Playlists and segments answer only while the key is valid.",
        call_id: callId,
        served_by: `qatom-demo-stream ${VERSION}`,
        edge: { colo: request.cf?.colo || null, country: request.cf?.country || null },
      });
    }

    // 2. token-gated HLS assets -------------------------------------------
    const hls = /^\/hls\/([^/]+)\/(.+)$/.exec(path);
    if (hls) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405, { allow: "GET, HEAD" });
      }
      const [, token, file] = hls;
      if (!/^[A-Za-z0-9_./-]+$/.test(file) || file.includes("..")) return json({ error: "not_found" }, 404);
      const v = await verifyToken(env.SIGNING_KEY, token);
      if (!v.ok) {
        return json({ error: "stream_key_invalid", reason: v.reason, expired_at: v.exp ? new Date(v.exp * 1000).toISOString() : undefined }, 403);
      }
      const assetReq = new Request(`${url.origin}/hls/${file}`, { method: "GET", headers: request.headers });
      const res = await env.ASSETS.fetch(assetReq);
      if (res.status === 404) return json({ error: "not_found" }, 404);
      const h = new Headers(res.headers);
      h.set("access-control-allow-origin", "*");
      if (file.endsWith(".m3u8")) {
        h.set("content-type", "application/vnd.apple.mpegurl");
        h.set("cache-control", "no-store");
      } else if (file.endsWith(".ts")) {
        h.set("content-type", "video/mp2t");
        h.set("cache-control", "private, max-age=300");
      }
      h.set("x-stream-key-expires", new Date(v.exp * 1000).toISOString());
      return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers: h });
    }

    // 3. player shell + poster (public, no token) -------------------------
    if (path === "/play" || path === "/play/") {
      return env.ASSETS.fetch(new Request(`${url.origin}/play.html`, { method: "GET" }));
    }
    if (path === "/poster.jpg") {
      const res = await env.ASSETS.fetch(new Request(`${url.origin}/poster.jpg`, { method: "GET" }));
      const h = new Headers(res.headers);
      h.set("access-control-allow-origin", "*");
      return new Response(res.body, { status: res.status, headers: h });
    }

    // 4. everything else: closed ------------------------------------------
    return json({ error: "not_found" }, 404);
  },
};
