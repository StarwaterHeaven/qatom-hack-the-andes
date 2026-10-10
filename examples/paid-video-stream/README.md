# Paid video stream example: ISS Earth Observations (NASA, 4K)

Sell video to AI agents, one purchase at a time. Each purchase returns **its own signed, time-limited HLS stream** and a one-click player link. When the key expires, the playlist and every segment answer 403. No accounts, no DRM vendor, no per-viewer servers: one small Cloudflare Worker in front of an HLS ladder.

The footage is NASA's 67-second "ISS 4K Crew Earth Observations" timelapse, a US Government work in the public domain (no copyright, no attribution required).

## Follow along: try it in 2 minutes

1. Connect the Qatom MCP in your AI client: `https://mcp.m.todaq.net/mcp`
2. Ask your agent: *"Search the Qatom catalog for ISS"*. You will find item **#27, "ISS Earth Observations Video Demo (NASA, 4K)"**, 0.10 USD-TDN.
3. *"Buy item 27."* Approve the purchase in your TODAQ app. The receipt carries `player_url`, `hls_url`, `poster_url` and `expires_at`.
4. Open `player_url`: the stream plays, and the rendition label moves between 1080p, 720p and 480p as the player adapts.
5. Prove the gate: change one character of the key in `hls_url` and open it. You get `{"error":"stream_key_invalid","reason":"bad_signature"}` with HTTP 403. Buy with `{"ttl_seconds": 60}`, wait a minute and reload: "Stream key rejected: expired".

## What the buyer gets

```json
{
  "ok": true,
  "kind": "video",
  "title": "ISS 4K Crew Earth Observations (NASA) - Qatom V4 paid stream demo",
  "hls_url": "https://<worker>/hls/<expiry>.<signature>/master.m3u8",
  "player_url": "https://<worker>/play?src=...",
  "poster_url": "https://<worker>/poster.jpg",
  "expires_at": "2026-10-17T15:00:00.000Z",
  "ttl_seconds": 3600,
  "duration_seconds": 67,
  "renditions": [{ "name": "1080p" }, { "name": "720p" }, { "name": "480p" }],
  "display": { "image": "...", "primary_link": "...", "primary_link_label": "Watch the stream", "caption": "..." },
  "agent_note": "Show display.image and display.primary_link to the user together..."
}
```

The `display` block and `agent_note` tell the buyer's agent how to present a media purchase: show the poster and the watch link, not the raw playlist URL.

## Run your own

```bash
node test/run.mjs                       # 10 offline checks (Node 20+)
bash build-hls.sh                       # downloads the NASA source and builds public/hls + poster (needs ffmpeg)
                                        # or: bash build-hls.sh my-video.mp4
npx wrangler login
npx wrangler secret put SERVICE_PATH    # 32+ random characters: the paid route answers only at /v/<SERVICE_PATH>
npx wrangler secret put SIGNING_KEY     # 32+ random characters: signs the stream keys
npx wrangler secret put QATOM_FULFILMENT_TOKEN   # recommended: the target then also needs Qatom's Authorization header
npx wrangler deploy
```

Then create the catalog item in the Qatom dashboard:

| Field | Value |
|---|---|
| Method | GET (POST and PUT also work, body `{"ttl_seconds": N}`) |
| Endpoint | `https://<your-worker>/v/<SERVICE_PATH>` (keep it secret; never in the description) |
| Request headers & secret parameters | header `Authorization`, Sensitive, value `Bearer <QATOM_FULFILMENT_TOKEN>`; then *Save headers & parameters* |
| Price | your call; the live example is 0.10 |
| Description | say what the buyer receives: a signed HLS stream, player link, poster and expiry; the source and its licence |

Input schema (paste as one line of plain ASCII; curly quotes from a rendered page fail to parse):

```
{"type":"object","properties":{"ttl_seconds":{"type":"integer","description":"How long the returned stream key stays valid, in seconds. Default 3600. Min 60, max 86400.","default":3600,"minimum":60,"maximum":86400}},"required":[]}
```

## Routes

| Route | Who | What |
|---|---|---|
| `GET/POST/PUT /v/<SERVICE_PATH>` | Qatom (the catalog item's endpoint) | Issues a stream key, returns the JSON above |
| `GET /hls/<key>/<file>` | Video players | Playlists and segments, only while the key is valid |
| `GET /play?src=<hls_url>` | People | hls.js player page |
| `GET /poster.jpg` | Anyone | Poster for the listing |
| anything else | | 404 |

The Worker fails closed: without both secrets every route returns 404.

## Things to know

- **The key is per purchase, not per viewer.** Anyone holding a valid `hls_url` can watch until it expires. That is the intended shape here (a rental). Binding to a device or session is a production option.
- **Static assets are capped at 25 MiB per file** on Cloudflare. Fine for short clips with 4-second segments; for a real library, keep your video on your own CDN or stream platform and have the Worker sign URLs for it.
- **One title per item here.** For a library, add an `asset_id` input (or one route per title) and sign against your existing storage. The buyer side does not change.

## Ideas for Hack the Andes

- A paid clip library: one item, `asset_id` input, priced per title.
- Pay-per-view for a live event: same key pattern in front of a live HLS origin.
- An agent that assembles a watch list from several sellers and buys only what the user approves.

---

**En español:** cada compra devuelve su propio stream HLS firmado y con vencimiento, más un enlace al reproductor. Prueba: busca "ISS" en el catálogo de Qatom, compra el ítem #27 (0.10 USD-TDN) y abre `player_url`. Para montar el tuyo, sigue "Run your own": `build-hls.sh` acepta tu propio video.
