# Worked examples

Examples A, B and the Harcourt reference case come from Nick Mumford's original qatom-seller-setup skill (September 2026). Examples C and D are Qatom's own builds.

## A. Portfolio of PDF reports

Vendor: 400 industry reports, priced $9, $29 or $99; some updated yearly.

- Item: a report. ID = stable slug (`ev-battery-supply-2026`). Aliases: ISBN, DOI, prior slugs, short title.
- Free: title, date, edition, pages, abstract, table of contents, price tier, licence terms.
- Paid: a short-lived download link, not the file: `download_url`, `expires_at`, `bytes`, `sha256`, `pages`, `edition`. PDFs streamed through MCP are rarely usable.
- Three prices -> three listings (`vendor_report_9`, `vendor_report_29`, `vendor_report_99`), each pinning its `tier` and `delivery=link`. A report bought through the wrong tier gets `400 wrong_tier` naming the right tool; because that call is still charged, make the tier unmistakable in `llms.txt`, the free metadata call and each description.
- Optional input `edition` (year); the ID alone serves the current edition.

```
GET /reports?q=battery                   free   search: id, title, date, tier
GET /reports/{id}                        free   metadata incl. price_tier and accepted inputs
GET /reports/{id}?key=...&delivery=link  paid   short-lived download link
```
Qatom endpoint for the $29 tier: `https://api.vendor.com/reports?key=SECRET&delivery=link&tier=29`

```json
{
  "type": "object",
  "required": ["report"],
  "properties": {
    "report":  {"type": "string", "description": "Report ID, ISBN or DOI from the catalog at https://vendor.com/llms.txt. This tool sells $29 reports only; the catalog lists each report's tier."},
    "edition": {"type": "integer", "description": "Optional. Publication year of an older edition. Omit for the current edition."}
  },
  "additionalProperties": false
}
```
Description (330 characters): `Industry report download, $29 tier. Returns a download link valid 15 minutes, with page count and SHA-256. Report IDs, ISBNs and each report's tier: vendor.com/llms.txt. Check a report free first at api.vendor.com/reports/{id}. A report in another tier is refused; use that tier's tool. Optional edition (year) for older editions.`

llms.txt catalog row:
```
| Report | ID | Also answers to | Tier | Edition | Pages | Page |
|---|---|---|---|---|---|---|
| EV Battery Supply 2026 | ev-battery-supply-2026 | ISBN 978-..., DOI 10..../evb26 | $29 (vendor_report_29) | 2026 | 84 | https://vendor.com/r/evb26 |
```

## B. Automated home valuation

Vendor: automated valuations of residential properties in selected counties.

- Item: a property. The catalog is the coverage (counties, inputs, units), not a list of addresses.
- Canonical ID: county-prefixed parcel number (APN). Aliases: normalised street address with or without unit, MLS number. Report the matched address in the `alias` block.
- Ambiguous address: `400 ambiguous_property` with candidate units and APNs. Out of coverage: `404 out_of_coverage` with the coverage URL.
- Free: property found and in coverage, characteristics on record, accepted inputs; optionally a broad band, never the point estimate.
- Paid: estimate at the valuation date, error band, comparable-sales summary (counts and dates, not licensed addresses). `mode=estimate` pinned.
- Required disclaimer on every response, e.g. "Not a licensed appraisal" where that is true.

| Input | Type | Unit | Real range | Published | In schema |
|---|---|---|---|---|---|
| property | string | - | - | - | required |
| living_area_sqft | integer | sq ft | 300-12,000 | 400-10,000 | optional |
| beds | integer | count | 0-12 | 0-10 | optional |
| baths | number | count, halves | 0-10 | 0-8 | optional |
| condition | enum | poor/fair/average/good/excellent | - | - | optional |
| renovated_kitchen | boolean | - | - | - | optional |
| as_of | date | YYYY-MM-DD | last 10 years | last 5 years | optional |
| mode | - | - | - | - | pinned, absent |

```json
{
  "type": "object",
  "required": ["property"],
  "properties": {
    "property":          {"type": "string", "description": "Street address with city and state, APN, or MLS number. Covered counties: https://vendor.com/llms.txt. Check coverage free at api.vendor.com/avm/{property}."},
    "living_area_sqft":  {"type": "integer", "minimum": 400, "maximum": 10000, "description": "Optional. Corrects the record. Range 400-10000."},
    "beds":              {"type": "integer", "minimum": 0, "maximum": 10, "description": "Optional. Range 0-10."},
    "baths":             {"type": "number", "minimum": 0, "maximum": 8, "description": "Optional. Halves allowed, e.g. 2.5. Range 0-8."},
    "condition":         {"type": "string", "enum": ["poor", "fair", "average", "good", "excellent"], "description": "Optional. Overall condition."},
    "renovated_kitchen": {"type": "boolean", "description": "Optional. Kitchen renovated in the last 10 years."},
    "as_of":             {"type": "string", "format": "date", "description": "Optional. Valuation date, within the last 5 years. Default today."}
  },
  "additionalProperties": false
}
```

## Reference case: how the pattern was proven (Harcourt Valuations)

A mining-valuation publisher reached this design in this order. Recognise the same stages in a vendor:
1. One Qatom tool per report -> lists of tools went stale. Replaced by one endpoint with the company as a parameter.
2. Free published value with no inputs; any input, or today's-prices mode, is paid.
3. Paid access by a key in Qatom's stored endpoint address; `402` without it, naming the free URL and the tool.
4. Today's-prices mode pinned in the address (`deck=closing`), so every Qatom call is the paid product.
5. Self-describing responses: valuation type, defaulted inputs and source, accepted axes, currency, out-of-range flag.
6. Actionable errors: unknown ticker -> coverage table; unsupported input -> accepted inputs; ambiguous symbol -> candidates.
7. Every exchange symbol accepted as an alias, generated from the catalog.
8. Catalog generated into `llms.txt` from the same file the endpoint reads; hand-kept copies and a separate public catalog were retired after drifting.
9. Schema read off the endpoint's own parameters, ranges set inside the fleet-wide limits, rate kept at 5-15%, mode pinned, `additionalProperties: false`, description cut under 500 characters.
10. Reports taken off Qatom and sold to people by card; agents buy the calculation.

Mistakes seen: unknown parameters silently ignored; a 404 charged; Qatom masking error text; a public demo key usable by scripts until capped; a site map not regenerated after a hand edit to the catalog; a schema that still named individual items.

## C. Live status: Chofex trip status (Hack the Andes demo)

Seller: a Mexican freight track-and-trace provider that already knows where every truck is (GPS, carrier ERP, the driver's WhatsApp updates). Buyers: shippers' and brokers' agents.

- Item: a shipment. ID = trip reference (`CHX-1002`); aliases `1002`, `chx1002`.
- Free: **trip check** confirms the reference and returns origin, destination and carrier. No position or ETA.
- Paid (0.010): **trip status** returns position with GPS age, status, ETA with delay, window and confidence, the driver's last update, a data-quality score with flags (`gps_stale`, `driver_unresponsive`, `eta_slipping`), a map link and a one-sentence summary in `es` or `en`.
- `next_steps` tells the buyer's agent what to do when something is wrong ("ask the carrier to call the driver").
- Why it sells: every shipper wanted status in its own format. One machine-readable answer lets each buyer's agent format it.
- Code: https://github.com/StarwaterHeaven/qatom-hack-the-andes/tree/main/examples/chofex-trip-status (synthetic trips, 15 offline tests).

## D. Paid entry and payouts: Centaur League

Seller: a game studio running correspondence chess for human+agent teams.

- Two paid items (create a challenge, join a challenge, 1.000 each) and seven free ones (search, view, move, leaderboard, spectate, cheer, feedback).
- Paid routes answer only at a secret path; free items are $0 catalog items, forwarded with no payment.
- The winner is paid 90% of the pot with `POST /v4/transfer` to the twin that paid the entry, found from the item's commodity transactions.
- `llms.txt` is generated from the live Qatom catalog every 10 minutes, so it cannot drift from what is listed.
- Fairness is verifiable: colours come from `sha256(match_id:creator:joiner)`, published with every match.
- Player kit: https://github.com/StarwaterHeaven/centaur-league . Read-me: https://centaurleague.games/llms.txt
