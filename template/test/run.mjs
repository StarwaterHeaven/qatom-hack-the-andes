// node test/run.mjs : offline test of the template Worker (GitHub is stubbed).
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

globalThis.fetch = async (url) => {
  if (String(url).endsWith('/repos/crafter-station/trx')) {
    return new Response(JSON.stringify({ full_name: 'crafter-station/trx', description: 'Agent-first transcription CLI', stargazers_count: 84, forks_count: 6, open_issues_count: 2, language: 'TypeScript', license: { spdx_id: 'MIT' }, default_branch: 'main', pushed_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), archived: false, topics: ['whisper'], html_url: 'https://github.com/crafter-station/trx' }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};

const env = { SERVICE_PATH: 's3cret', PUBLIC_URL: 'https://store.test' };
const call = async (path, body) => {
  const r = await worker.fetch(new Request(`https://store.test${path}`, { method: 'POST', body: JSON.stringify(body) }), env, {});
  return { status: r.status, body: await r.json() };
};

let r = await call('/paid/s3cret/repo-card', { repo: 'https://github.com/crafter-station/trx' });
assert.equal(r.status, 200); assert.equal(r.body.result.stars, 84); assert.equal(r.body.alias.resolved, 'crafter-station/trx');
console.log('ok 1 - paid card with URL alias');
r = await call('/paid/s3cret/repo-card', { repo: 'nobody/nothing' });
assert.equal(r.status, 404); assert.equal(r.body.error.code, 'item_not_found');
console.log('ok 2 - unknown repo');
r = await call('/api/repo-check', { repo: 'crafter-station/trx', extra: 1 });
assert.equal(r.status, 400); assert.equal(r.body.error.code, 'unknown_parameter');
console.log('ok 3 - unknown input refused');
r = await call('/api/repo-card', { repo: 'crafter-station/trx' });
assert.equal(r.status, 404);
console.log('ok 4 - paid item not reachable on the free path');
// Qatom's fulfilment header: with QATOM_FULFILMENT_TOKEN set, the paid route needs Authorization: Bearer <token>.
const envH = { ...env, QATOM_FULFILMENT_TOKEN: 'tok' };
const callH = async (path, body, headers = {}) => {
  const r = await worker.fetch(new Request(`https://store.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), envH, {});
  return { status: r.status, body: await r.json() };
};
r = await callH('/paid/s3cret/repo-card', { repo: 'crafter-station/trx' });
assert.equal(r.status, 404);
console.log('ok 5 - paid route without the fulfilment header is 404');
r = await callH('/paid/s3cret/repo-card', { repo: 'crafter-station/trx' }, { authorization: 'Bearer wrong' });
assert.equal(r.status, 404);
console.log('ok 6 - wrong fulfilment header is 404');
r = await callH('/paid/s3cret/repo-card', { repo: 'crafter-station/trx' }, { authorization: 'Bearer tok' });
assert.equal(r.status, 200);
console.log('ok 7 - right fulfilment header answers');
r = await worker.fetch(new Request('https://store.test/paid/s3cret/repo-card', { method: 'POST', headers: { authorization: 'Bearer old' }, body: JSON.stringify({ repo: 'crafter-station/trx' }) }), { ...envH, QATOM_FULFILMENT_TOKEN_PREVIOUS: 'old' }, {});
assert.equal(r.status, 200);
console.log('ok 8 - previous token accepted during rotation');
console.log('\n8 passed');
