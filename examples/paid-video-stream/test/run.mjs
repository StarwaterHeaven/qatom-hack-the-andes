// Offline checks for the paid video stream Worker (Node 20+): node test/run.mjs
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

const files = { '/hls/master.m3u8': '#EXTM3U\n', '/hls/480p/seg_000.ts': 'TS', '/play.html': '<html>', '/poster.jpg': 'JPG' };
const ASSETS = { fetch: async (req) => { const p = new URL(req.url).pathname; return p in files ? new Response(files[p], { status: 200 }) : new Response('nf', { status: 404 }); } };
const env = { SERVICE_PATH: 'test-secret', SIGNING_KEY: 'k'.repeat(40), ASSETS };
const call = (path, init = {}, e = env) => worker.fetch(new Request('https://demo.test' + path, init), e);
let n = 0; const t = async (name, fn) => { await fn(); console.log(`ok ${++n} - ${name}`); };

await t('fails closed without secrets', async () => { assert.equal((await call('/v/test-secret', {}, { ASSETS })).status, 404); });
await t('wrong secret path is 404', async () => { assert.equal((await call('/v/wrong')).status, 404); });
await t('direct asset path is closed', async () => { assert.equal((await call('/hls/master.m3u8')).status, 404); });
let body;
await t('purchase returns signed hls_url, player_url and display envelope', async () => {
  const r = await call('/v/test-secret?ttl_seconds=600'); assert.equal(r.status, 200); body = await r.json();
  assert.match(body.hls_url, /\/hls\/\d+\.[A-Za-z0-9_-]+\/master\.m3u8$/); assert.equal(body.ttl_seconds, 600);
  assert.ok(body.player_url.includes('/play?src=')); assert.equal(body.display.primary_link, body.player_url);
});
await t('POST body ttl is clamped to 60..86400', async () => {
  const r = await call('/v/test-secret', { method: 'POST', body: JSON.stringify({ ttl_seconds: 5 }) }); assert.equal((await r.json()).ttl_seconds, 60);
});
await t('DELETE on the target is 405', async () => { assert.equal((await call('/v/test-secret', { method: 'DELETE' })).status, 405); });
await t('signed playlist and segment answer 200', async () => {
  const path = new URL(body.hls_url).pathname; assert.equal((await call(path)).status, 200);
  assert.equal((await call(path.replace('master.m3u8', '480p/seg_000.ts'))).status, 200);
});
await t('tampered key is 403 bad_signature', async () => {
  const path = new URL(body.hls_url).pathname.replace(/\.([A-Za-z0-9_-])/, '.x$1'); const r = await call(path);
  assert.equal(r.status, 403); assert.equal((await r.json()).reason, 'bad_signature');
});
await t('key for another expiry is refused', async () => {
  const sig = new URL(body.hls_url).pathname.split('/')[2].split('.')[1];
  assert.equal((await call(`/hls/1000000000.${sig}/master.m3u8`)).status, 403);
});
await t('player and poster are public', async () => { assert.equal((await call('/play?src=x')).status, 200); assert.equal((await call('/poster.jpg')).status, 200); });
await t('with QATOM_FULFILMENT_TOKEN, the target needs the Authorization header', async () => {
  const e = { ...env, QATOM_FULFILMENT_TOKEN: 'tok' };
  assert.equal((await call('/v/test-secret', {}, e)).status, 404);
  assert.equal((await call('/v/test-secret', { headers: { authorization: 'Bearer nope' } }, e)).status, 404);
  assert.equal((await call('/v/test-secret', { headers: { authorization: 'Bearer tok' } }, e)).status, 200);
});
console.log(`\n${n} passed`);
