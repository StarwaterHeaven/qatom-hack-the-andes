# Qatom use-case library

Every pattern we know of, with a live example where one exists. Catalog ids and prices are from the public Qatom catalog as of 7 Oct 2026; run `catalog_search` for the current list. Use this in stage 0 to suggest a first item, and in stage 2 to borrow a proven shape.

## A. Pay-per-call answers (the default first item)

### A1. Calculation or model output
A computed answer at the buyer's inputs. Stateless, read-only, the data already exists.
- **Harcourt Mining NAV Query** (#24, 1.000): mining NAV per share; ticker alone gives NAV at the latest close; metal prices or a discount rate turn it into a scenario. The reference case for the whole guide: one item per product family, aliases from the catalog, `defaulted_inputs`, `out_of_range`, generated `llms.txt`.
- **BTC Options Market Read** (#22, Market Structure OS, 0.000001): a plain-English read of what the options market prices for a date. Shows how small a price can go.
- **Spreadsheet formulas as tools** (#41–#77, 0.001–0.002 each): loan payment, CAGR, break-even, unit price, sales tax, paint for a room. One spreadsheet becomes thirty-seven tools. Good for anyone whose value lives in Excel.

### A2. Live status or record lookup
"Where is it / what state is it in", from data the seller already collects.
- **Chofex trip status** (demo, Hack the Andes): shipment reference in, location, status, ETA, last driver update and data-quality flags out. A free sibling confirms the reference exists. See `worked-examples.md`.
- **npm Package Freshness Check** (#26, 0.001): latest version and release freshness of an npm package. A developer tool a coding agent calls during dependency work.
- **Weather** (#80, 0.050): daily forecast for any place for 15 days from NOAA GFS data. Public data, packaged for agents.

### A3. Data feed or dataset slice
A query over a dataset the seller curates (events, prices, listings, registries). Price per query or per row band; give a free count or coverage check.
- Pattern only so far. Candidates: a LatAm tech events index, a supplier directory, a regional price index.

### A4. Wrapper around an existing paid API
The seller already pays for or runs an API with a key. A thin Worker adds the key server side, reshapes the answer for agents and sells the call. The key never reaches the buyer. Check the upstream API's terms allow resale.

### A5. Repo or CLI turned into a service
A GitHub project whose core function a stranger's agent would call: transcription, auditing, conversion, generation, scoring. Host the function and sell the call; keep the repo open source.
- Starter: https://github.com/StarwaterHeaven/qatom-hack-the-andes/tree/main/template . Candidates from the Crafter Station community: https://github.com/StarwaterHeaven/qatom-hack-the-andes/blob/main/docs/repo-to-catalog.md

## B. Content and media

### B1. Documents and reports
Sell a short-lived download link, not the file: `download_url`, `expires_at`, `bytes`, `sha256`, `pages`. One item per price tier. A free metadata call returns title, abstract and tier.
- Live customer: Digital Experience Corp paywalls its media library this way.

### B2. Video streams (HLS)
Each purchase returns a signed HLS playlist URL, a player URL and a poster.
- **ISS Earth Observations Video Demo** (#27, Dobox, 0.100).
- Live customer: Atlalux runs white-label video monetization.

### B3. Access pass or membership
One payment grants a role or a period of access; the endpoint issues a token or adds the buyer to a list.
- **Audience Member** (#31, Truce Media, 5.000).

## C. Commerce with state

### C1. Paid entry, prize payouts (games and contests)
Both sides pay to enter; the seller pays the winner from its own twin with `POST /v4/transfer`. The entry's payer is found from the item's commodity transactions. Pure-skill games only.
- **Centaur League** (#32 create, #33 join, 1.000 each): human+agent correspondence chess, 90% of the pot to the winner, verifiable coin flip for colours, payouts to the paying wallet.

### C2. Free tools around a paid core
Most calls in a good storefront are free: search, view, status, leaderboard, spectate, cheer. They pull agents in; the paid item is the moment of value.
- Centaur League: seven free items (#34–#36, #38–#40, #78) around two paid ones.

### C3. Credits and resale
Sell units of something the buyer spends later: compute credits, API credits, discounted aftermarket capacity.
- **Compute Credits** (#79, 0.100).

### C4. Orders and bookings (with a human yes)
An agent places an order or booking on the buyer's behalf. Keep a preview step and a confirmation token so money moves only after a human says yes.

## D. Platform and buyer patterns

### D1. Programmatic buyer
A business buys from the catalog at volume through its own agent wallet and spend limits.
- Live customer: Gracia AI.

### D2. Orchestration platform (embed Qatom)
A platform lets its own users buy and sell through Qatom inside its product, taking a share.
- Live customer: Northern Village.

### D3. Seller agent
An agent that sells a merchant's catalog in chat (web, WhatsApp) and closes fixed-price sales. Configurable seller agents are on the Qatom roadmap; until then, a Claude skill plus the master MCP does it.

## E. Storefront defaults (every seller)

- **customer_feedback** (price 0): message to the seller's inbox, rate capped. Centaur League #39 is the reference.
- **Free check** beside each paid item.
- **llms.txt** read-me, generated.
- Coming on Qatom: an auto-generated read-me per merchant and a `read_me_url` on every search result. Until then the seller hosts `llms.txt`.
