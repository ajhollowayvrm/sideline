/* Sideline LAMBDA LAB — standalone harness for the Phase 47 cloud-save backend.

   infra/lambda/index.mjs is the one piece of Sideline that doesn't run in the browser, so the
   QA gate can't reach it. This harness runs the REAL handler against in-memory stubs of
   DynamoDB and S3 (installed via an ESM resolve hook, so nothing has to be npm-installed) and
   drives the whole API: auth, list, pull, push, optimistic concurrency, validation, delete.

   The check that earns its keep is "a rejected push leaves the winner's bytes untouched".
   Two devices pushing from the same baseRev compute the same next rev, so a rev-keyed S3 path
   let the loser overwrite — and then, on cleanup, DELETE — the winning save. Object keys are
   unique per ATTEMPT for exactly that reason, and this lab is what holds that line.

   Run:  node test/lambdalab.js        (needs Node 22.15+ for module.registerHooks) */

const path = require('path');
const { pathToFileURL } = require('url');

let registerHooks;
try { ({ registerHooks } = require('node:module')); } catch (e) { /* older node */ }
if (typeof registerHooks !== 'function') {
  console.log('SKIP  lambdalab needs Node 22.15+ (module.registerHooks) — node ' + process.version);
  process.exit(0);
}

/* ---------- stub AWS SDK (source strings, served as data: modules) ---------- */
const DDB_STUB = `
export const _store = new Map();
const k = o => o.owner + '|' + o.career;
export class ConditionalCheckFailedException extends Error { constructor(){ super('cond'); this.name='ConditionalCheckFailedException'; } }
class Cmd { constructor(i){ this.input=i; this.type=this.constructor.NAME; } }
export class PutItemCommand extends Cmd { static NAME='put'; }
export class GetItemCommand extends Cmd { static NAME='get'; }
export class QueryCommand extends Cmd { static NAME='query'; }
export class DeleteItemCommand extends Cmd { static NAME='delete'; }
export class DynamoDBClient {
  async send(cmd){
    const i = cmd.input;
    if (cmd.type === 'get') { const it=_store.get(k(i.Key)); return { Item: it?{...it}:undefined }; }
    if (cmd.type === 'delete') { _store.delete(k(i.Key)); return {}; }
    if (cmd.type === 'query') {
      const owner = i.ExpressionAttributeValues[':o'];
      return { Items: [..._store.values()].filter(x=>x.owner===owner).map(x=>({...x})) };
    }
    if (cmd.type === 'put') {
      const cur = _store.get(k(i.Item)), c = i.ConditionExpression;
      if (c === 'attribute_not_exists(#o)' && cur) throw new ConditionalCheckFailedException();
      if (c === '#r = :base' && (!cur || cur.rev !== i.ExpressionAttributeValues[':base'])) throw new ConditionalCheckFailedException();
      if (c && c !== 'attribute_not_exists(#o)' && c !== '#r = :base') throw new Error('unsupported condition: ' + c);
      _store.set(k(i.Item), {...i.Item});
      return {};
    }
    throw new Error('unknown command ' + cmd.type);
  }
}`;
// marshall/unmarshall are used symmetrically by the handler, so identity is faithful.
const UTIL_STUB = `
export const marshall = (o, opts) => {
  if (!opts || !opts.removeUndefinedValues) return {...o};
  const out = {}; for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
};
export const unmarshall = o => ({...o});`;
const S3_STUB = `
export const _bucket = new Map();
class Cmd { constructor(i){ this.input=i; this.type=this.constructor.NAME; } }
export class PutObjectCommand extends Cmd { static NAME='put'; }
export class GetObjectCommand extends Cmd { static NAME='get'; }
export class DeleteObjectCommand extends Cmd { static NAME='delete'; }
export class S3Client {
  async send(cmd){
    const { Key, Body } = cmd.input;
    if (cmd.type === 'put') { _bucket.set(Key, Body); return {}; }
    if (cmd.type === 'delete') { if (!_bucket.has(Key)) throw new Error('NoSuchKey ' + Key); _bucket.delete(Key); return {}; }
    if (cmd.type === 'get') {
      if (!_bucket.has(Key)) throw new Error('NoSuchKey ' + Key);
      return { Body: { transformToByteArray: async () => new Uint8Array(_bucket.get(Key)) } };
    }
  }
}`;
const dataUrl = src => 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
const STUBS = {
  '@aws-sdk/client-dynamodb': dataUrl(DDB_STUB),
  '@aws-sdk/util-dynamodb': dataUrl(UTIL_STUB),
  '@aws-sdk/client-s3': dataUrl(S3_STUB),
};
// Same specifier → same data: URL → same module instance, so the handler and this file share
// the very same in-memory table and bucket.
registerHooks({
  resolve(spec, ctx, next) { return STUBS[spec] ? { url: STUBS[spec], shortCircuit: true } : next(spec, ctx); },
});

/* ---------- the drive ---------- */
process.env.TABLE = 'T'; process.env.BUCKET = 'B'; process.env.PEPPER = 'arn:aws:cloudformation:stack/test';

const results = [];
const ok = (n, c, d = '') => { results.push({ pass: !!c }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

(async () => {
  const { handler } = await import(pathToFileURL(path.join(__dirname, '..', 'infra', 'lambda', 'index.mjs')).href);
  const { _store } = await import(STUBS['@aws-sdk/client-dynamodb']);
  const { _bucket } = await import(STUBS['@aws-sdk/client-s3']);

  const CODE = '7K2M9QX4B8TR', OTHER = 'ZZZZZZZZZZZZ', ID = 'cme7tvegw-9ix';
  const call = async (method, p, { code = CODE, body, noAuth } = {}) => {
    const res = await handler({
      rawPath: p, requestContext: { http: { method } },
      headers: noAuth ? {} : { authorization: 'Bearer ' + code },
      body: body ? JSON.stringify(body) : undefined, isBase64Encoded: false,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  const b64 = s => Buffer.from(s).toString('base64');
  const text = b => Buffer.from(b, 'base64').toString();
  const keysFor = rev => [..._bucket.keys()].filter(k => k.includes(`/${ID}/${rev}-`));
  const META = { coach: 'A Holloway', team: 'Oregon', teamAbbr: 'ORE', color: '#154733', week: 5, year: 2026, phase: 'Regular Season', savedAt: 1 };

  // ---- auth: the career code is the only gate
  ok('No Authorization header → 401', (await call('GET', '/v1/ping', { noAuth: true })).status === 401);
  ok('A malformed code → 401', (await call('GET', '/v1/ping', { code: 'nope' })).status === 401);
  ok('A valid code pings', (await call('GET', '/v1/ping')).body.ok === true);
  ok('Server normalizes a code exactly like the client does',
    (await call('GET', '/v1/ping', { code: 'side-7k2m-9qx4-b8tr' })).status === 200);

  // ---- first push
  let r = await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 0, meta: META, enc: 'gz', blob: b64('SAVE-1') } });
  ok('First push creates rev 1', r.status === 200 && r.body.rev === 1, JSON.stringify(r.body));
  ok('Blob lands in S3 under a per-attempt key', keysFor(1).length === 1, [..._bucket.keys()].join(','));
  ok('The raw career code is never stored',
    ![..._store.keys()].join('|').includes(CODE) && [..._store.values()].every(v => JSON.stringify(v).indexOf(CODE) < 0));

  // ---- list + pull
  r = await call('GET', '/v1/careers');
  ok('List returns the career with its meta card', r.body.careers.length === 1 && r.body.careers[0].careerId === ID && r.body.careers[0].meta.team === 'Oregon');
  ok('List never ships the blob', r.body.careers[0].blob === undefined);
  r = await call('GET', '/v1/careers/' + ID);
  ok('Pull returns the exact bytes', text(r.body.blob) === 'SAVE-1' && r.body.rev === 1 && r.body.enc === 'gz');

  // ---- one code is one namespace
  ok('A different code sees nothing', (await call('GET', '/v1/careers', { code: OTHER })).body.careers.length === 0);
  ok('A different code cannot pull the career', (await call('GET', '/v1/careers/' + ID, { code: OTHER })).status === 404);

  // ---- optimistic concurrency (the heart of it)
  r = await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 1, meta: META, enc: 'gz', blob: b64('SAVE-2'), device: 'Phone' } });
  ok('A push from the current rev advances to 2', r.status === 200 && r.body.rev === 2);
  ok('The superseded object is swept', keysFor(1).length === 0 && keysFor(2).length === 1);

  const before = new Map(_bucket);
  r = await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 1, meta: META, enc: 'gz', blob: b64('STALE'), device: 'Desktop' } });
  ok('A stale push is rejected with 409', r.status === 409 && r.body.error === 'conflict' && r.body.rev === 2);
  ok('409 hands back the winning revision (rev, device, meta — no blob)',
    r.body.device === 'Phone' && !!r.body.meta && r.body.blob === undefined);
  ok('A rejected push leaves the winner’s bytes untouched', text((await call('GET', '/v1/careers/' + ID)).body.blob) === 'SAVE-2');
  ok('A rejected push leaves no orphan behind',
    _bucket.size === before.size && [...before.keys()].every(k => _bucket.has(k)), `${before.size} → ${_bucket.size}`);
  r = await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 1, force: true, meta: META, enc: 'gz', blob: b64('FORCED') } });
  ok('A forced push lands on top of the CURRENT rev, not baseRev', r.status === 200 && r.body.rev === 3);
  ok('Forced bytes are what a pull returns', text((await call('GET', '/v1/careers/' + ID)).body.blob) === 'FORCED');
  r = await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 0, meta: META, enc: 'gz', blob: b64('X') } });
  ok('A second "first push" (baseRev 0) conflicts instead of wiping', r.status === 409 && r.body.rev === 3);

  // ---- input validation
  ok('Missing blob → 400', (await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 3, meta: META } })).status === 400);
  ok('Oversized blob → 413', (await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 3, meta: META, blob: 'A'.repeat(5_000_001) } })).status === 413);
  ok('A path-traversal career id → 400', (await call('GET', '/v1/careers/..%2Fetc%2Fpasswd')).status === 400);
  ok('An unknown route → 404', (await call('GET', '/v1/nope')).status === 404);
  ok('An unsupported method → 405', (await call('POST', '/v1/careers/' + ID)).status === 405);
  ok('An unknown career → 404', (await call('GET', '/v1/careers/cdoesnot-exist')).status === 404);
  await call('PUT', '/v1/careers/' + ID, { body: { baseRev: 3, blob: b64('Y'),
    meta: { team: 'X', evil: { a: 1 }, week: 'not a number', coach: 'C'.repeat(500) } } });
  const stored = [..._store.values()][0];
  ok('Meta is whitelisted — junk dropped, strings clamped',
    stored.meta.evil === undefined && stored.meta.week === undefined && stored.meta.coach.length === 80 && stored.meta.team === 'X');

  // ---- delete
  ok('Delete removes the index item and the blob',
    (await call('DELETE', '/v1/careers/' + ID)).status === 200 && _store.size === 0 && _bucket.size === 0);
  ok('Delete is idempotent', (await call('DELETE', '/v1/careers/' + ID)).status === 200);

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} handler checks passed =====`);
  process.exit(results.every(x => x.pass) ? 0 : 1);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
