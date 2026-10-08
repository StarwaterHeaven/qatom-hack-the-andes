// qatom-kit: turn one catalog.json plus a few handler functions into a Qatom-ready Worker.
//
// One source of truth: catalog.json describes the seller and every item (name, price, method, inputs).
// From it this module builds:
//   - the HTTP endpoint (free routes at /api/<route>, paid routes at /paid/<SERVICE_PATH>/<route>)
//   - input validation with precise errors (unknown_parameter, bad_value, ...)
//   - the response envelope agents learn from (inputs, defaulted_inputs, accepts, out_of_range, summary)
//   - the JSON Schema and listing text for each Qatom catalog item
//   - /llms.txt, the read-me agents look for
// No dependencies. Runs on Cloudflare Workers and Node 20+.

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...JSON_HEADERS, ...extra } });
}

export class ApiError extends Error {
  constructor(status, code, message, next = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.next = next;
  }
}

// ---------- schema and listing ----------

function publicRange(inp) {
  const lo = inp.public_min ?? inp.min;
  const hi = inp.public_max ?? inp.max;
  return lo === undefined && hi === undefined ? null : [lo, hi];
}

function inputDescription(inp) {
  const parts = [];
  if (!inp.required) parts.push('Optional.');
  if (inp.description) parts.push(inp.description);
  if (inp.unit) parts.push(`Unit: ${inp.unit}.`);
  const r = publicRange(inp);
  if (r) parts.push(r[0] !== undefined && r[1] !== undefined ? `Range ${r[0]}-${r[1]}.` : r[0] !== undefined ? `At least ${r[0]}.` : `At most ${r[1]}.`);
  if (inp.default !== undefined) parts.push(`Default ${inp.default}.`);
  return parts.join(' ');
}

export function itemSchema(item) {
  const properties = {};
  const required = [];
  for (const inp of item.inputs || []) {
    const p = { type: inp.type === 'date' ? 'string' : inp.type, description: inputDescription(inp) };
    if (inp.type === 'date') p.format = 'date';
    if (inp.enum) p.enum = inp.enum;
    const r = publicRange(inp);
    if (r && (inp.type === 'number' || inp.type === 'integer')) {
      if (r[0] !== undefined) p.minimum = r[0];
      if (r[1] !== undefined) p.maximum = r[1];
    }
    if (inp.min_length) p.minLength = inp.min_length;
    if (inp.max_length) p.maxLength = inp.max_length;
    if (inp.format) p.format = inp.format;
    properties[inp.name] = p;
    if (inp.required) required.push(inp.name);
  }
  const schema = { type: 'object', additionalProperties: false, properties };
  if (required.length) schema.required = required;
  return schema;
}

export function toolName(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function endpointUrl(catalog, item, base = catalog.seller.base_url) {
  return item.paid
    ? `${base}/paid/<SERVICE_PATH>/${item.route}`
    : `${base}/api/${item.route}`;
}

export function fillBase(text, base) {
  return String(text || '').replaceAll('{BASE}', base);
}

export function listing(catalog, item, base = catalog.seller.base_url) {
  const description = fillBase(item.listing_description, base);
  return {
    name: item.name,
    tool_name: toolName(item.name),
    price: item.paid ? Number(item.price).toFixed(3) : '0',
    method: item.method || 'POST',
    endpoint: endpointUrl(catalog, item, base),
    description,
    description_chars: [...description].length,
    schema: itemSchema(item),
  };
}

// Pre-launch checks from the seller guide (stage 6), the ones a script can make.
export function lintCatalog(catalog) {
  const problems = [];
  const names = new Set();
  for (const item of catalog.items) {
    const l = listing(catalog, item);
    const where = `item "${item.id}"`;
    if (names.has(l.tool_name)) problems.push(`${where}: duplicate tool name ${l.tool_name}`);
    names.add(l.tool_name);
    if (l.description_chars > 1024) problems.push(`${where}: description is ${l.description_chars} characters (keep at or under 1,024)`);
    if (!/llms\.txt/.test(l.description)) problems.push(`${where}: description should point to llms.txt`);
    if (item.paid && !(Number(item.price) >= 0.001)) problems.push(`${where}: paid item needs a price of at least 0.001 USD-TDN`);
    if (item.paid && Math.abs(Number(item.price) * 1000 - Math.round(Number(item.price) * 1000)) > 1e-9) problems.push(`${where}: price ${item.price} has more than three decimals; USD-TDN settles to 0.001`);
    if (!item.paid && Number(item.price || 0) !== 0) problems.push(`${where}: free item must have price 0`);
    for (const inp of item.inputs || []) {
      if (!/^[a-z][a-z0-9_]*$/.test(inp.name)) problems.push(`${where}: input "${inp.name}" should be short lowercase snake_case`);
      if (!['string', 'number', 'integer', 'boolean', 'date'].includes(inp.type)) problems.push(`${where}: input "${inp.name}" has unknown type ${inp.type}`);
    }
    for (const word of item.forbidden_in_listing || []) {
      if (l.description.includes(word) || JSON.stringify(l.schema).includes(word)) problems.push(`${where}: listing names "${word}"; keep individual items out of the listing`);
    }
  }
  if (!catalog.items.some((i) => i.handler === 'feedback')) problems.push('storefront: add the free customer feedback item');
  return problems;
}

// ---------- input parsing and validation ----------

async function readInputs(request) {
  const url = new URL(request.url);
  const out = Object.create(null);
  for (const [k, v] of url.searchParams) {
    if (k in out) throw new ApiError(400, 'bad_value', `${k} was sent more than once; send each input once.`);
    out[k] = v;
  }
  if (request.method === 'POST' || request.method === 'PUT') {
    const text = await request.text();
    if (text.trim()) {
      let body;
      try { body = JSON.parse(text); } catch { throw new ApiError(400, 'bad_json', 'The request body is not valid JSON.'); }
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const k of Object.keys(body)) out[k] = body[k];
      }
      else throw new ApiError(400, 'bad_json', 'The request body must be a JSON object of named inputs.');
    }
  }
  return out;
}

const NUMBER = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function coerce(inp, raw) {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'object') throw new ApiError(400, 'bad_value', `${inp.name} must be a single value, not a list or an object.`);
  if (typeof raw === 'string' && raw.trim() === '') return undefined;
  switch (inp.type) {
    case 'number':
    case 'integer': {
      const n = typeof raw === 'number' ? raw : NUMBER.test(String(raw).trim()) ? Number(String(raw).trim()) : NaN;
      if (!Number.isFinite(n) || (inp.type === 'integer' && !Number.isInteger(n))) {
        throw new ApiError(400, 'bad_value', `${inp.name} must be ${inp.type === 'integer' ? 'a whole number' : 'a number'}.`);
      }
      return n;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const s = String(raw).toLowerCase();
      if (['true', '1', 'yes', 'si', 'sí'].includes(s)) return true;
      if (['false', '0', 'no'].includes(s)) return false;
      throw new ApiError(400, 'bad_value', `${inp.name} must be true or false.`);
    }
    case 'date': {
      const s = String(raw).trim();
      const d = new Date(`${s}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
        throw new ApiError(400, 'bad_value', `${inp.name} must be a real date as YYYY-MM-DD.`);
      }
      return s;
    }
    default: {
      if (typeof raw !== 'string' && typeof raw !== 'number') throw new ApiError(400, 'bad_value', `${inp.name} must be text.`);
      const s = String(raw).trim();
      if (inp.max_length && s.length > inp.max_length) throw new ApiError(400, 'bad_value', `${inp.name} is longer than ${inp.max_length} characters.`);
      if (inp.min_length && s.length < inp.min_length) throw new ApiError(400, 'bad_value', `${inp.name} needs at least ${inp.min_length} characters.`);
      if (inp.format === 'email' && !EMAIL.test(s)) throw new ApiError(400, 'bad_value', `${inp.name} must be an email address.`);
      return s;
    }
  }
}

function rangeText(r) {
  if (!r) return '';
  if (r[0] !== undefined && r[1] !== undefined) return ` (${r[0]}-${r[1]})`;
  return r[0] !== undefined ? ` (at least ${r[0]})` : ` (at most ${r[1]})`;
}

export function validate(item, raw) {
  const known = new Set((item.inputs || []).map((i) => i.name));
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length) {
    throw new ApiError(400, 'unknown_parameter', `This item does not take ${unknown.map((u) => `"${u}"`).join(', ')}. It was refused rather than ignored, so you do not get an answer to a different question.`, { accepts: [...known] });
  }
  const inputs = {};
  const defaulted = {};
  let outOfRange = false;
  for (const inp of item.inputs || []) {
    let v = coerce(inp, raw[inp.name]);
    if (v === undefined) {
      if (inp.required) {
        const code = inp.subject ? 'item_required' : 'wrong_input';
        throw new ApiError(400, code, `${inp.name} is required.`, { accepts: [...known] });
      }
      if (inp.default !== undefined) {
        v = inp.default;
        defaulted[inp.name] = { value: v, source: 'default' };
      } else continue;
    }
    if (inp.enum) {
      const match = inp.enum.find((e) => String(e).toLowerCase() === String(v).toLowerCase());
      if (match === undefined) throw new ApiError(400, 'bad_value', `${inp.name} must be one of: ${inp.enum.join(', ')}.`);
      v = match;
    }
    if (typeof v === 'number') {
      if ((inp.min !== undefined && v < inp.min) || (inp.max !== undefined && v > inp.max)) {
        const r = publicRange(inp);
        throw new ApiError(400, 'bad_value', `${inp.name} is outside the supported range${rangeText(r)}.`);
      }
      const r = publicRange(inp);
      if (r && ((r[0] !== undefined && v < r[0]) || (r[1] !== undefined && v > r[1]))) outOfRange = true;
    }
    inputs[inp.name] = v;
  }
  return { inputs, defaulted, outOfRange };
}

function accepts(item) {
  return (item.inputs || []).map((i) => {
    const a = { input: i.name, type: i.type, required: !!i.required };
    if (i.unit) a.unit = i.unit;
    if (i.enum) a.choices = i.enum;
    const r = publicRange(i);
    if (r) a.range = r;
    return a;
  });
}

// ---------- llms.txt ----------

export function llmsTxt(catalog, base) {
  const s = catalog.seller;
  const now = new Date().toUTCString();
  const rows = catalog.items.map((it) => {
    const l = listing(catalog, it, base);
    const req = (it.inputs || []).filter((i) => i.required).map((i) => i.name).join(', ') || '-';
    return `| ${it.name} | ${l.tool_name} | ${it.paid ? `${Number(it.price).toFixed(3)} USD-TDN` : 'free'} | ${l.method} | ${req} |`;
  }).join('\n');
  const schemas = catalog.items.map((it) => {
    const lines = (it.inputs || []).map((i) => `    ${i.name}${i.required ? '' : '?'}: ${i.enum ? i.enum.join('|') : i.type} - ${inputDescription(i)}`).join('\n');
    return `### ${it.name}\n${fillBase(it.listing_description, base)}\n\n${lines || '    (no inputs)'}`;
  }).join('\n\n');
  const examples = (catalog.llms?.examples || []).map((e, n) => `${n + 1}. ${e}`).join('\n');
  const errors = Object.entries(ERROR_GUIDE).map(([code, next]) => `- \`${code}\`: ${next}`).join('\n');
  return `# ${s.name}

> ${catalog.llms?.summary || s.summary}

Generated from catalog.json at ${now}. Nothing here is hand-maintained.

## How to call these items

From the Qatom master MCP (https://mcp.m.todaq.net/mcp): catalog_search for "${catalog.llms?.search_term || s.name}", then agent_checkout with the item id and the arguments below. Free items cost nothing and return their answer inside the receipt.

## Worked examples (agents copy examples)

${examples || '(add examples to catalog.json under llms.examples)'}

## Catalog

| item | tool name | price | method | required inputs |
|---|---|---|---|---|
${rows}

## Input schemas

${schemas}

## Response conventions

Every response is JSON with ok: true or false. A good answer carries item, answer_type, as_of, inputs (what you sent), defaulted_inputs (what we filled in, and from where), accepts (every input this item takes), result, out_of_range and a one-sentence summary. Units are stated in the response.

Errors carry error.code, error.message and a next step:

${errors}

Note: when a call fails through Qatom, the buyer may see a generic payment error instead of the code above. The usual causes are a missing required input, a misspelt input name, or an unknown reference.

## For people, not agents

${catalog.llms?.people || `Site: ${s.site || base}`}

## Resources

- Site: ${s.site || base}
- This file: ${base}/llms.txt
- Feedback: the free customer feedback item above${s.contact ? `, or ${s.contact}` : ''}
- Qatom: https://qatom.ai , master MCP https://mcp.m.todaq.net/mcp , docs https://docs.m.todaq.net
`;
}

const ERROR_GUIDE = {
  item_required: 'send the required reference input.',
  item_not_found: 'check the reference against this file, or call the free check item first.',
  ambiguous_item: 'pick one of the candidates returned; we never guess.',
  wrong_input: 'send only the inputs listed under accepts.',
  unknown_parameter: 'remove the input named in the message; it was refused, not ignored.',
  bad_value: 'send a value inside the stated range or choices.',
  bad_json: 'send a JSON object of named inputs.',
  rate_limited: 'wait and try again later.',
  method_not_allowed: 'use GET or POST.',
  not_configured: 'the seller has not finished setting this item up; try again later.',
  not_found: 'see the catalog table above for the routes that exist.',
  internal_error: 'try again; if it repeats, send the free feedback item with the details.',
};

// ---------- the Worker ----------

// Constant-time comparison for the secret path. Use 32+ random characters for SERVICE_PATH.
function sameSecret(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function makeWorker(catalog, handlers) {
  const byRoute = new Map(catalog.items.map((it) => [`${it.paid ? 'paid' : 'free'}:${it.route}`, it]));
  for (const it of catalog.items) {
    if (!handlers[it.handler]) throw new Error(`catalog item "${it.id}" names handler "${it.handler}", which handlers.mjs does not export`);
  }

  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);
      const base = (env.PUBLIC_URL || url.origin).replace(/\/+$/, '');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      try {
        if (path === '/llms.txt') return new Response(llmsTxt(catalog, base), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
        if (path === '/health') return json({ ok: true, service: catalog.seller.name, items: catalog.items.length });
        if (path === '/') return json({ ok: true, service: catalog.seller.name, read_me: `${base}/llms.txt`, summary: catalog.seller.summary });

        let item = null;
        const free = path.match(/^\/api\/([a-z0-9-]+)$/);
        const paid = path.match(/^\/paid\/([^/]+)\/([a-z0-9-]+)$/);
        if (free) item = byRoute.get(`free:${free[1]}`);
        if (paid) {
          // The paid route answers only at the secret path. Anything else looks like a missing page.
          if (!env.SERVICE_PATH || !sameSecret(paid[1], env.SERVICE_PATH)) item = null;
          else item = byRoute.get(`paid:${paid[2]}`);
        }
        if (!item) throw new ApiError(404, 'not_found', 'No such route.', { read_me: `${base}/llms.txt` });
        if (!['GET', 'POST'].includes(request.method)) throw new ApiError(405, 'method_not_allowed', 'Use GET or POST.');

        const raw = await readInputs(request);
        const { inputs, defaulted, outOfRange } = validate(item, raw);
        const out = await handlers[item.handler](inputs, { env, ctx, item, catalog, base, request });
        return json({
          ok: true,
          item: out.item ?? item.id,
          ...(out.alias ? { alias: out.alias } : {}),
          answer_type: out.answer_type || item.answer_type || 'current',
          as_of: out.as_of || new Date().toISOString(),
          inputs,
          defaulted_inputs: defaulted,
          accepts: accepts(item),
          result: out.result,
          out_of_range: outOfRange || !!out.out_of_range,
          summary: out.summary,
          ...(out.next_steps ? { next_steps: out.next_steps } : {}),
          ...(item.disclaimer || catalog.seller.disclaimer ? { disclaimer: item.disclaimer || catalog.seller.disclaimer } : {}),
        });
      } catch (e) {
        if (e instanceof ApiError) {
          return json({ ok: false, error: { code: e.code, message: e.message, next_step: ERROR_GUIDE[e.code] }, ...e.next, read_me: `${base}/llms.txt` }, e.status);
        }
        console.error(e);
        return json({ ok: false, error: { code: 'internal_error', message: 'Something went wrong on our side.', next_step: ERROR_GUIDE.internal_error } }, 500);
      }
    },
  };
}

// ---------- the storefront default: customer feedback ----------
// Stores the message in KV (binding FEEDBACK) and, optionally, forwards it by email through Resend
// (secrets RESEND_API_KEY, FEEDBACK_TO, FEEDBACK_FROM). At least one of the two must be set up,
// or the item answers 503 not_configured instead of pretending the seller will read it.
// The hourly cap is counted in KV, so it holds across Worker instances (approximately: KV is eventually consistent).

export async function feedbackHandler(inputs, { env, catalog }) {
  const canStore = !!env.FEEDBACK;
  const canEmail = !!(env.RESEND_API_KEY && env.FEEDBACK_TO);
  if (!canStore && !canEmail) {
    throw new ApiError(503, 'not_configured', 'Feedback is not set up on this store yet (no FEEDBACK KV namespace and no email settings).');
  }
  if (canStore) {
    const key = `rate:${Math.floor(Date.now() / 3_600_000)}`;
    const used = Number((await env.FEEDBACK.get(key)) || 0);
    if (used >= Number(env.FEEDBACK_PER_HOUR || 30)) throw new ApiError(429, 'rate_limited', 'Feedback is capped per hour. Please try again later.');
    await env.FEEDBACK.put(key, String(used + 1), { expirationTtl: 7200 });
  }

  const id = `fb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const record = { id, at: new Date().toISOString(), ...inputs };
  let stored = false;
  let emailed = false;
  if (canStore) { await env.FEEDBACK.put(`msg:${id}`, JSON.stringify(record)); stored = true; }
  if (canEmail) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.FEEDBACK_FROM || 'feedback@example.com',
        to: env.FEEDBACK_TO,
        ...(inputs.from_email ? { reply_to: inputs.from_email } : {}),
        subject: `[${catalog.seller.name}] feedback ${inputs.subject_ref ? `on ${inputs.subject_ref}` : ''}`.trim(),
        text: `${inputs.message}\n\nFrom: ${inputs.from_email || 'not given'}\nAbout: ${inputs.subject_ref || '-'}\nId: ${id}`,
      }),
    });
    emailed = r.ok;
  }
  if (!stored && !emailed) throw new ApiError(503, 'not_configured', 'Feedback could not be delivered right now. Please try again later.');
  return {
    answer_type: 'action',
    result: { feedback_id: id, stored, forwarded_by_email: emailed },
    summary: 'Thank you. Your feedback was received by the seller.',
  };
}
