# Qatom at Hack the Andes

Build things AI agents can **find, pay for and use**, and get paid per call.

Everything you need to make your API, repo, data or game Qatom-capable before and during [Hack the Andes](https://hacktheandes.com) (Lima, 17–18 October 2026). *[Leer en español](README.es.md).*

| | What it is |
|---|---|
| [Qatom seller guide](https://github.com/StarwaterHeaven/qatom-seller-guide) | An agent skill that walks you from "I have a thing" to a live, tested catalog item: first use case, endpoint, schema, listing, `llms.txt`, launch report. Includes every Qatom use case we know of. It lives in its own repo, the canonical version for every Qatom seller. |
| [`template/`](template/) | A Cloudflare Worker starter: describe your items in one `catalog.json`, put your function in `handlers.mjs`, deploy. Validation, errors, the secret paid route, the feedback item and `/llms.txt` come built in. |
| [`examples/mx-freight-trip-status`](examples/mx-freight-trip-status/) | Mexican Freight Agentic Tracking and Tracing example: freight trip status for agents (synthetic data on real Mexican corridors). |
| [`docs/repo-to-catalog.md`](docs/repo-to-catalog.md) | Turning open-source repos into catalogs, with candidates from Crafter Station. |
| [`STORES.md`](STORES.md) | Live stores. Add yours. |

## 1. Claim Qatom Max

Every Hack the Andes participant gets **6 months of Qatom Max free**: https://www.qatom.ai/hack-the-andes . Winning teams get 12 (1st) or 7 (2nd, 3rd) months of Max for the team, plus a giftable 12-month Pro voucher each.

## 2. Be a buyer in five minutes

1. In Claude (or any MCP client): **Settings > Connectors > Add custom connector**, URL `https://mcp.m.todaq.net/mcp`. Sign in when asked.
2. Ask your agent: *"Use Qatom to search the catalog for weather."* It calls `catalog_search`.
3. *"Check my agent wallet."* (`agent_wallet_info`). Fund it from the primary wallet if it is empty.
4. *"Buy the weather forecast for Lima."* It asks you to approve, then calls `agent_checkout` and shows the answer and a receipt.

**Follow tonight's demo:** ask *"Search the Qatom catalog for Mexican freight"*. Item #182 checks a trip for free (try `MXF-1002`), #181 gives live status, ETA and driver update for 0.01. Details: [`examples/mx-freight-trip-status`](examples/mx-freight-trip-status/).

Try free items too: Centaur League's `search challenges`, `spectate` and `leaderboard` cost nothing.

**Money safety:** your agent can only spend what is in its own agent twin. It cannot touch your primary wallet or your card. Fund it like handing over a little cash.

## 3. Be a seller in thirty minutes

```bash
git clone https://github.com/StarwaterHeaven/qatom-hack-the-andes
cd qatom-hack-the-andes/template          # work inside template/; it imports ../lib
node test/run.mjs                         # offline checks (Node 20+)
npx wrangler login
npx wrangler kv namespace create FEEDBACK # paste the id into wrangler.toml (the feedback item needs it)
npx wrangler secret put SERVICE_PATH      # 32+ random characters
npx wrangler deploy                       # note the URL it prints
node ../lib/gen.mjs catalog.json --base https://<your-worker-url>   # listing fields and llms.txt in out/
```

Then create your items in the Qatom dashboard from `out/listing.md`, and buy one with your own agent.

Or have your agent do the design with you:

```bash
npx skills add StarwaterHeaven/qatom-seller-guide --skill qatom-seller-guide
```

and say *"Turn this repo into a Qatom catalog."*

## How a Qatom call works

One round trip. The buyer's agent holds a funded wallet (its twin). It calls `agent_checkout` on a catalog item. Qatom checks the limits, settles the payment in USD-TDN and calls the seller's endpoint. The seller's answer comes back in the same call, with a receipt and a transaction id.

## Links

- Qatom: https://qatom.ai · API docs: https://docs.m.todaq.net · Master MCP: `https://mcp.m.todaq.net/mcp`
- Live build session with Hassan Khan: Friday 9 October 2026, 6:30–8:00 PM ET / 5:30–7:00 PM Lima, on Zoom: https://luma.com/830d5l83
- During the hackathon: the Hack the Andes Discord, or the contact on https://www.qatom.ai/hack-the-andes
- Human+agent chess on Qatom: https://centaurleague.games · kit: https://github.com/StarwaterHeaven/centaur-league

## About

Qatom is a product of TODAQ Micro Inc. (Toronto, Canada). The seller guide builds on Nick Mumford's original qatom-seller-setup skill. MIT licensed.
