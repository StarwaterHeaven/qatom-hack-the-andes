# Trip status: a Qatom demo for Chofex

**"¿Dónde está mi carga?"** sold to AI agents, one call at a time.

[Chofex](https://www.chofex.com) runs an AI track-and-trace employee inside Mexican carriers' WhatsApp groups. It already knows where every truck is: GPS from Samsara and 50+ providers, the carrier's ERP or spreadsheet, and what the driver said in the group. Shippers ask for that status all day, and each one wants it in a different format.

This demo shows the next step: the same answer as **one machine-readable catalog item on Qatom**. A shipper's or broker's agent asks Qatom, pays 0.010 USD-TDN and gets position, status, ETA, the driver's last update and data-quality flags. The buyer's agent formats it however its human wants.

> **Demo data.** Five synthetic trips on real corridors (Monterrey–Nuevo Laredo, León–CDMX, Querétaro–Guadalajara, Saltillo–San Luis Potosí, Manzanillo–Guadalajara). No real carrier, driver or load. Trucks move with the clock, so every call shows fresh positions.

## The items

| Item | Price | What it does |
|---|---|---|
| Chofex demo: trip status | 0.010 | Position, status, ETA with delay and confidence, last driver WhatsApp update, data-quality score and flags, map link, one-sentence summary in Spanish or English |
| Chofex demo: trip check | free | Confirms a reference exists: origin, destination, carrier. No position, no ETA |
| Chofex demo: customer feedback | free | Message to the seller's inbox |

The trips:

| Ref | Corridor | What you will see |
|---|---|---|
| CHX-1001 | Monterrey → Nuevo Laredo | On the road, on time |
| CHX-1002 | León → Ciudad de México | ETA slipping; the delay changes between calls (a "signal") |
| CHX-1003 | Querétaro → Guadalajara | On the road, on time |
| CHX-1004 | Saltillo → San Luis Potosí | Stopped, GPS stale, driver not answering; no ETA, next steps suggested |
| CHX-1005 | Manzanillo → Guadalajara | Delivered, with proof of delivery |

Short forms work: `1002`, `chx1002`, `chx 1002`. The response's `alias` block shows what it resolved to.

## Run it

```bash
node test/run.mjs                      # 15 offline checks (Node 20+)
npx wrangler login
npx wrangler kv namespace create FEEDBACK   # paste the id into wrangler.toml
npx wrangler secret put SERVICE_PATH   # 32+ random characters
npx wrangler deploy                    # note the URL it prints
node ../../lib/gen.mjs catalog.json --base https://<your-worker-url>   # listing fields + llms.txt in out/
```

Then create the three items in the Qatom dashboard from `out/listing.md`. Paid endpoint: `https://<your-worker-url>/paid/<SERVICE_PATH>/trip-status`. Free endpoints: `/api/trip-check`, `/api/feedback`. Read-me for agents: `/llms.txt`.

## The five-minute demo

Before the call: deploy, create the three items, connect the Qatom master MCP (`https://mcp.m.todaq.net/mcp`) in Claude, and put about $1 in the agent twin.

1. **The question a shipper asks 50 times a day.** In Claude: *"Soy el agente de Demo Calzado León. ¿Dónde está mi carga CHX-1002? Usa Qatom."* The agent runs `catalog_search` for "trip status", calls the free **trip check**, then asks you to approve 0.010 for **trip status**. Approve.
2. **One answer, any format.** It reads back the Spanish summary: position, kilometres left, ETA and the delay. Ask *"Dámelo como mensaje para el almacén de CDMX"* or *"as a table in English"*. Same data; the buyer's agent does the formatting Chofex used to build per customer.
3. **The signal changes.** Ask again three or four minutes later. The delay and ETA have moved. This is hackathon track 1: *una señal cambia; tu sistema tiene que entenderla y responder.*
4. **When something is wrong.** *"¿Y la CHX-1004?"* Stopped, GPS stale for over 90 minutes, driver not answering, no ETA, and `next_steps` saying what to do. Data quality is part of the answer.
5. **Follow the money.** Show the receipt and transaction id from `agent_checkout`, and that the agent twin went down by 0.010. The agent can only spend what is in its own twin; the human tops it up.

**The line for Chofex:** every shipper wanted status in a different format, and the data lived in GPS, ERP and Excel. A single `trip_status` answer on Qatom lets every shipper's agent take it in whatever shape it likes, and gets Chofex paid per answer. At scale, across all Chofex carriers, it becomes the machine-readable track-and-trace layer for Mexican freight: a broker's agent asks one tool "where is my load?"

## What to build on it at Hack the Andes

- **Track 1, a signal changes:** an agent that watches a set of loads and acts when an ETA slips or a truck goes quiet: tells the warehouse, rebooks the dock slot, pings the carrier.
- **Track 2, build the bridge:** connect shippers' systems (ERP, WMS, email) to trip status through Qatom, so loads are tracked without anyone opening WhatsApp.
- **Track 3, the interface is the product:** a dispatcher's console or a WhatsApp reply flow that shows the same answer to people.

## Next steps for a real version

- Chofex hosts the endpoint against its own GPS/ERP/WhatsApp data, per carrier, with each shipper only seeing its own loads (an access token per shipper, pinned in the stored endpoint URL or passed as an input).
- Price per call or per tracked trip; MXN settlement and driver payouts are a later step.
- Add a free coverage item (which carriers and corridors are live) and the feedback item, already here.
