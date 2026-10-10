# Template: your store on Qatom

1. Edit `catalog.json`: your seller name, `base_url`, and one entry per catalog item (name, price, method, route, inputs, listing description with `{BASE}/llms.txt`). Keep the free feedback item.
2. Put your code in `src/handlers.mjs`. The example sells a GitHub repo card; replace it with your repo's core function. Each handler gets validated inputs and returns `{ result, summary }`.
3. `node test/run.mjs` (Node 20+). Work inside this folder: the code imports `../lib`.
4. `npx wrangler login`, then `npx wrangler kv namespace create FEEDBACK` and paste its id into `wrangler.toml` (the feedback item answers 503 until it has KV or email). `npx wrangler secret put SERVICE_PATH` (32+ random characters), `npx wrangler secret put QATOM_FULFILMENT_TOKEN` (`openssl rand -hex 24`) and `npx wrangler secret put GITHUB_TOKEN` (a fine-grained token with no scopes, for the example). `npx wrangler deploy`.
5. `node ../lib/gen.mjs catalog.json --base https://<your-worker-url>` until the checks pass.
6. Create each item in the Qatom dashboard from `out/listing.md`. The paid endpoint is `https://<your-url>/paid/<SERVICE_PATH>/<route>`; free ones are `https://<your-url>/api/<route>`. On each paid item add a Sensitive header `Authorization: Bearer <QATOM_FULFILMENT_TOKEN>` under Request headers & secret parameters and click Save headers & parameters.
7. Connect `https://mcp.m.todaq.net/mcp` in Claude, find your item with `catalog_search`, buy it once with `agent_checkout`.

What the kit (`../lib/qatom-kit.mjs`) does for you: refuses unknown inputs instead of ignoring them, checks types, choices and ranges, fills defaults and reports them, wraps every answer in the envelope agents learn from, gives every error a code and a next step, hides the paid route behind your secret path and Qatom's fulfilment header, serves `/llms.txt` generated from `catalog.json`, and handles the feedback item (optional KV storage and Resend email).
