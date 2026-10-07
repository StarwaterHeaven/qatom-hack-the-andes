// node test/run.mjs : exercises the Worker locally, no network needed.
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

const env = { SERVICE_PATH: 'test-secret', PUBLIC_URL: 'https://demo.test' };
const call = async (path, body, method = 'POST') => {
  const init = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const r = await worker.fetch(new Request(`https://demo.test${path}`, init), env, {});
  return { status: r.status, body: r.headers.get('content-type').includes('json') ? await r.json() : await r.text() };
};

let n = 0;
const ok = (name) => console.log(`ok ${++n} - ${name}`);

{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-1001' });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.equal(r.body.result.status, 'en_ruta');
  assert.ok(r.body.result.eta.at); assert.ok(r.body.summary.includes('CHX-1001'));
  assert.deepEqual(r.body.defaulted_inputs, { lang: { value: 'es', source: 'default' } });
  ok('paid status, moving truck, Spanish default');
}
{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: '1004', lang: 'en' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.alias, { requested: '1004', resolved: 'CHX-1004' });
  assert.ok(r.body.result.flags.includes('driver_unresponsive'));
  assert.equal(r.body.result.eta.at, null);
  assert.ok(r.body.next_steps.length > 0);
  ok('alias resolves, stopped truck flagged, no ETA');
}
{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-1002' });
  assert.ok(r.body.result.eta.delay_min > 0); assert.ok(r.body.result.flags.includes('eta_slipping'));
  ok('delayed truck reports delay and slipping ETA');
}
{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-1005' });
  assert.equal(r.body.result.status, 'entregado'); assert.ok(r.body.result.proof_of_delivery);
  ok('delivered trip has proof of delivery');
}
{
  const r = await call('/paid/wrong/trip-status', { trip_ref: 'CHX-1001' });
  assert.equal(r.status, 404);
  const r2 = await call('/api/trip-status', { trip_ref: 'CHX-1001' });
  assert.equal(r2.status, 404);
  ok('paid route hidden without the secret path');
}
{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-1001', langg: 'en' });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, 'unknown_parameter');
  ok('misspelt input refused, not ignored');
}
{
  const r = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-9999' });
  assert.equal(r.status, 404); assert.equal(r.body.error.code, 'item_not_found'); assert.ok(r.body.known_refs_for_demo);
  ok('unknown reference returns item_not_found with next step');
}
{
  const r = await call('/paid/test-secret/trip-status', {});
  assert.equal(r.status, 400); assert.equal(r.body.error.code, 'item_required');
  const r2 = await call('/paid/test-secret/trip-status', { trip_ref: 'CHX-1001', lang: 'fr' });
  assert.equal(r2.body.error.code, 'bad_value');
  ok('missing and bad inputs');
}
{
  const r = await call('/api/trip-check', { trip_ref: 'chx 1003' });
  assert.equal(r.status, 200); assert.equal(r.body.result.exists, true); assert.equal(r.body.result.position, undefined);
  ok('free check confirms reference without giving away position');
}
{
  const r = await call('/api/trip-check?trip_ref=CHX-1001', undefined, 'GET');
  assert.equal(r.status, 200);
  ok('GET with query inputs works');
}
{
  const r = await call('/api/feedback', { message: 'ETA window please', subject_ref: 'CHX-1002' });
  assert.equal(r.status, 503); assert.equal(r.body.error.code, 'not_configured');
  ok('feedback refuses honestly when no storage or email is set up');
}
{
  const kv = new Map();
  const FEEDBACK = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } };
  const send = (body) => worker.fetch(new Request('https://demo.test/api/feedback', { method: 'POST', body: JSON.stringify(body) }), { ...env, FEEDBACK, FEEDBACK_PER_HOUR: '2' }, {});
  const a = await (await send({ message: 'ETA window please', from_email: 'ops@example.com' })).json();
  assert.equal(a.result.stored, true);
  assert.equal((await send({ message: 'second' })).status, 200);
  assert.equal((await send({ message: 'third' })).status, 429);
  assert.equal((await send({ message: 'bad email', from_email: 'nope' })).status, 400);
  ok('feedback stored in KV, hourly cap enforced, email format checked');
}
{
  const r1 = await call('/paid/test-secret/trip-status', JSON.parse('{"__proto__":{"trip_ref":"CHX-1003"}}'));
  assert.equal(r1.status, 400);
  const r2 = await call('/paid/test-secret/trip-status', { trip_ref: ['CHX-1001'] });
  assert.equal(r2.body.error.code, 'bad_value');
  const r3 = await call('/api/trip-check?trip_ref=CHX-1001&trip_ref=CHX-1002', undefined, 'GET');
  assert.equal(r3.body.error.code, 'bad_value');
  const r4 = await call('/paid/test-secret/trip-status', [1, 2]);
  assert.equal(r4.body.error.code, 'bad_json');
  ok('prototype keys, arrays, repeated params and array bodies refused');
}
{
  const r = await call('/llms.txt', undefined, 'GET');
  assert.equal(r.status, 200); assert.ok(r.body.includes('# Trip Status demo for Chofex')); assert.ok(r.body.includes('https://demo.test/llms.txt'));
  ok('llms.txt generated with the live base URL');
}
{
  const t0 = Date.UTC(2026, 9, 9, 22, 0); // 9 Oct 2026 17:00 Lima
  const { tripState } = await import('../src/trips.mjs');
  const a = tripState('CHX-1001', t0), b = tripState('CHX-1001', t0 + 10 * 60000);
  assert.ok(b.distance_remaining_km < a.distance_remaining_km);
  const d0 = tripState('CHX-1002', t0).eta.delay_min, d3 = tripState('CHX-1002', t0 + 3 * 60000).eta.delay_min;
  assert.notEqual(d0, d3);
  ok('the truck moves and the delay changes within minutes');
}
console.log(`\n${n} passed`);
