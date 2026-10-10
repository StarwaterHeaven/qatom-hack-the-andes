#!/usr/bin/env node
// Generate the Qatom listing fields and llms.txt from catalog.json, and run the pre-launch checks.
//
//   node lib/gen.mjs path/to/catalog.json [--base https://your-worker.example.com] [--out dir]
//
// Writes <out>/listing.md (paste each item into the Qatom dashboard) and <out>/llms.txt (preview;
// the Worker serves the live copy at /llms.txt). Exits 1 if a check fails.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { listing, llmsTxt, lintCatalog } from './qatom-kit.mjs';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) { console.error('usage: node lib/gen.mjs path/to/catalog.json [--base URL] [--out dir]'); process.exit(2); }
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const catalog = JSON.parse(readFileSync(file, 'utf8'));
const base = (opt('base') || catalog.seller.base_url).replace(/\/+$/, '');
catalog.seller.base_url = base;
const out = resolve(opt('out') || join(dirname(file), 'out'));
mkdirSync(out, { recursive: true });

const md = [`# Qatom catalog items for ${catalog.seller.name}`, '', `Generated ${new Date().toISOString()} from ${file}. Create each item in the Qatom dashboard (Catalog items > New item). Replace <SERVICE_PATH> in paid endpoints with your secret (wrangler secret put SERVICE_PATH). On every paid item, open Request headers & secret parameters, add a Sensitive header `Authorization` = `Bearer <QATOM_FULFILMENT_TOKEN>` (the same value as `wrangler secret put QATOM_FULFILMENT_TOKEN`), and click Save headers & parameters.`, ''];
for (const item of catalog.items) {
  const l = listing(catalog, item, base);
  md.push(`## ${l.name}`, '',
    `- Tool name agents will see: \`${l.tool_name}\``,
    `- Price: ${l.price} USD-TDN per call${item.paid ? '' : ' (free)'}`,
    `- Method: ${l.method}`,
    `- Endpoint: \`${l.endpoint}\``,
    `- Description (${l.description_chars} of 1,024 characters):`, '', '```', l.description, '```', '',
    '- Input schema:', '', '```json', JSON.stringify(l.schema, null, 2), '```', '');
}
writeFileSync(join(out, 'listing.md'), md.join('\n'));
writeFileSync(join(out, 'llms.txt'), llmsTxt(catalog, base));

const problems = lintCatalog(catalog);
console.log(`wrote ${join(out, 'listing.md')} and ${join(out, 'llms.txt')}`);
for (const item of catalog.items) {
  const l = listing(catalog, item, base);
  console.log(`  ${l.tool_name.padEnd(36)} ${String(l.price).padStart(6)}  ${l.method.padEnd(4)}  description ${l.description_chars}/1024`);
}
if (problems.length) {
  console.log('\nchecks FAILED:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nchecks passed');
