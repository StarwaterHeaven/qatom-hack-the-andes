# Repo to catalog: a playbook for Crafter Station

Crafter Station ships agent-first tools: CLIs with JSON envelopes, MCP servers, agent skills. Most of them are one step from being something any agent, anywhere, can find and pay for. This is how to take that step with Qatom, and which repos to start with.

## Why bother

- **Your repo gets a business model without closing the source.** The code stays MIT. You sell the hosted call: the compute, the data, the uptime, the curation.
- **Micropayments work.** Prices go down to fractions of a cent per call, settled inside the transaction. No Stripe minimums, no invoices.
- **Agents find you.** Public items appear in `catalog_search` on the Qatom master MCP, which any Claude, Grok or other MCP client can connect to.
- **Hack the Andes participants get 6 months of Qatom Max** (claim at https://www.qatom.ai/hack-the-andes). Winning teams get 12 or 7 months of Max for the team.

## The five steps

1. **Find the call.** What would a stranger's agent ask your project to do? One verb, one answer: "transcribe this URL", "audit this lockfile", "where is this load". Skip anything that needs the buyer's own login on a third-party service.
2. **Write `catalog.json`.** Work inside `template/` (it imports `../lib`; if you copy it elsewhere, copy `lib/` beside it). Describe the item: name, price, inputs with types and ranges, a free check, and the feedback item. Run `node ../lib/gen.mjs catalog.json` until the checks pass.
3. **Wrap the function.** Put your repo's core function in `src/handlers.mjs`. It gets validated inputs and returns `{ result, summary }`. The kit handles errors, the response envelope, the secret paid path and `/llms.txt`.
4. **Deploy.** `wrangler login`, create the FEEDBACK KV namespace, `wrangler secret put SERVICE_PATH`, `wrangler deploy`, then regenerate with `--base <your URL>`. (Anything that serves HTTPS works; a Worker is just the shortest path.)
5. **List and buy it once.** Create the items in the Qatom dashboard from `out/listing.md`. Connect the master MCP in Claude, `catalog_search` your item, buy it with `agent_checkout`. Add your store to [`STORES.md`](../STORES.md) with a pull request.

Or let an agent do steps 1 to 3 with you: install the seller guide skill and say *"turn this repo into a Qatom catalog"*.

```bash
npx skills add StarwaterHeaven/qatom-seller-guide --skill qatom-seller-guide
```

## What makes a repo a good first item

Score each out of 2; 7 or more is a strong first item.

| Test | 2 | 1 | 0 |
|---|---|---|---|
| **One call, one answer** | Stateless request, JSON back | Needs a short job or polling | Needs a session or UI |
| **Valuable per call** | Saves real compute, time or money | Convenient | Trivial |
| **Runs server-side** | Pure function or your own data | Needs a key you own (wrap it) | Needs the buyer's login |
| **Free sibling exists** | Obvious free check or preview | Weak | None |
| **Unique** | Your data or your curation | Packaged public data | Commodity |

## Candidates from Crafter Station

Suggestions from reading each repo's public README on 7 Oct 2026. The maintainers decide; these are starting points, not plans.

| Repo | Item idea | Price idea | Free sibling | Score |
|---|---|---|---|---|
| [skills / supply-chain-audit](https://github.com/crafter-station/skills/tree/main/skills/supply-chain-audit) | **Lockfile audit**: the skill scans a machine today; a hosted version takes a `package-lock.json` or `pnpm-lock.yaml` and returns a PASS/FAIL verdict against the current IOC pack, with the hits | 0.010 per audit | IOC pack version and date | 9 |
| [trx](https://github.com/crafter-station/trx) | **Transcribe a media URL**: Whisper transcript with timestamps, language detection | per call, tiered by duration (one item per tier) | Probe: duration, language guess, whether it is reachable | 8 |
| hack0 index / [crafter-tracker](https://github.com/crafter-station/crafter-tracker) | **LatAm tech events**: query by country, city, date range or topic; the hack0 index listed 186 events, 84 communities and 20 countries in September | 0.001 per query | Count of matching events | 8 |
| [blaze](https://github.com/crafter-station/blaze) | **Provision a database**: Postgres, MySQL, Mongo, Redis or libSQL in 200 ms; returns a connection string | per database or per day (credits pattern) | Engines and regions available | 7 |
| [text0](https://github.com/crafter-station/text0) | **Autocomplete**: next-text suggestions for a passage and style | 0.001 per call | none needed beyond a sample | 6 |
| [makeables](https://github.com/crafter-station/makeables-community) | **Event kit**: a badge or sticker sheet from a Luma event URL and a logo | per kit | Preview thumbnail | 6 |
| [spaceship-cli](https://github.com/crafter-station/spaceship-cli) | **Domain availability and price**: check a batch of names (wraps a registrar key you hold) | 0.002 per batch | Single-name check, rate-capped | 6 |

**Not good public items (and why):** `uber-cli` and `wapi` act on the buyer's own accounts and numbers, so the value is in the buyer's login, not your hosting. Keep those as private tools, or sell something around them (a template, a hosted setup) rather than the call itself.

## A community sprint

A suggested format for Crafter Station before and during Hack the Andes:

- **Ship or Sink: catalog edition.** Each team takes one repo from the table (or their own), and ships a live catalog item with a free check, a feedback item and a generated `llms.txt`. Done = another team's agent finds it with `catalog_search` and buys it once.
- **Pair it with the logistics track.** Trip status shows the shape for logistics; any team can buy from it and build on it.
- **Show it off.** Add the store to `STORES.md`. Centaur League (human+agent chess on Qatom) is open for a break between builds: https://centaurleague.games
