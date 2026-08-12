/* Sideline cloud saves — the whole backend, one Lambda behind a Function URL.
   -------------------------------------------------------------------------
   Storage split (a Sideline save is 1.4-2.5 MB encoded, gzips to ~300-600 KB):
     - S3         holds the save BLOB   (gzipped JSON, one object per revision)
     - DynamoDB   holds the slot INDEX  (rev, s3 key, size + the little meta card the
                  Load screen renders: team, coach, week, phase, savedAt)
   DynamoDB's 400 KB item cap is why the blob does not live in the table.

   Auth is a bearer "career code" the client mints itself (12 Crockford base32 chars = 60
   bits). We never store the raw code — the partition key is sha256(pepper:code), so the
   table alone cannot be turned back into working codes. There is no registration step: a
   code is a namespace, and an unused one simply lists empty.

   Concurrency is optimistic. Every career carries a monotonic `rev`; a push declares the
   `baseRev` it was built from and DynamoDB's conditional write rejects it (409) if another
   device moved first. The blob is written to a NEW rev-keyed object BEFORE the conditional
   update, so a rejected push can never clobber the winning device's bytes — the loser just
   leaves a small orphan we delete on the next successful commit.

   Routes (all JSON, all requiring `Authorization: Bearer <code>`):
     GET    /v1/ping                 -> {ok, version}                 (code still required)
     GET    /v1/careers              -> {careers:[{careerId, rev, size, updatedAt, meta}]}
     GET    /v1/careers/{careerId}   -> {careerId, rev, updatedAt, meta, enc, blob}
     PUT    /v1/careers/{careerId}   <- {baseRev, meta, enc, blob, device?, force?}
                                     -> 200 {rev, updatedAt} | 409 {error:'conflict', ...}
     DELETE /v1/careers/{careerId}   -> {ok:true}
*/

import { createHash, randomUUID } from 'node:crypto';
import {
  DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const TABLE  = process.env.TABLE;
const BUCKET = process.env.BUCKET;
const PEPPER = process.env.PEPPER || '';
const MAX_BLOB = Number(process.env.MAX_BLOB || 5_000_000);   // base64 chars; ~3.7 MB of gzip
const API_VERSION = 1;

const ddb = new DynamoDBClient({});
const s3  = new S3Client({});

// Crockford base32, 12 chars — the exact alphabet the client mints from (no I/L/O/U).
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/;
const CAREER_RE = /^[a-z0-9-]{1,64}$/;

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

const ownerKey = code => 'o#' + createHash('sha256').update(PEPPER + ':' + code).digest('hex');

// Must stay byte-identical to the client's cloudNormCode: the owner key is a hash of the
// normalized code, so any divergence would put the same person in two namespaces.
function normalizeCode(raw) {
  let s = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length === 16 && s.slice(0, 4) === 'SIDE') s = s.slice(4);
  return s.replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
}
function bearer(event) {
  const h = event.headers || {};
  const m = /^Bearer\s+(.+)$/i.exec((h.authorization || h.Authorization || '').trim());
  if (!m) return null;
  const code = normalizeCode(m[1]);
  return CODE_RE.test(code) ? code : null;
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
}

// Only the small descriptor the Load screen needs — never trust the client for more.
function cleanMeta(m) {
  if (!m || typeof m !== 'object') return {};
  const out = {};
  for (const k of ['coach', 'team', 'teamAbbr', 'color', 'phase', 'note']) {
    if (typeof m[k] === 'string') out[k] = m[k].slice(0, 80);
  }
  for (const k of ['week', 'year', 'savedAt', 'wins', 'losses']) {
    if (Number.isFinite(m[k])) out[k] = m[k];
  }
  return out;
}

const itemOut = it => ({
  careerId: String(it.career).replace(/^c#/, ''),
  rev: it.rev, size: it.size, updatedAt: it.updatedAt,
  enc: it.enc || 'gz', device: it.device || '', meta: it.meta || {},
});

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  const path = (event.rawPath || '/').replace(/\/+$/, '') || '/';

  const code = bearer(event);
  if (!code) return json(401, { error: 'bad_code', message: 'Authorization: Bearer <12-char career code> required.' });
  const owner = ownerKey(code);

  try {
    if (method === 'GET' && path === '/v1/ping') return json(200, { ok: true, version: API_VERSION });

    if (path === '/v1/careers') {
      if (method !== 'GET') return json(405, { error: 'method' });
      const r = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: '#o = :o',
        ExpressionAttributeNames: { '#o': 'owner' },
        ExpressionAttributeValues: marshall({ ':o': owner }),
        ProjectionExpression: 'career, rev, size, updatedAt, enc, device, meta',
      }));
      return json(200, { careers: (r.Items || []).map(i => itemOut(unmarshall(i))) });
    }

    const m = /^\/v1\/careers\/([^/]+)$/.exec(path);
    if (!m) return json(404, { error: 'route' });
    const careerId = decodeURIComponent(m[1]);
    if (!CAREER_RE.test(careerId)) return json(400, { error: 'bad_career_id' });
    const key = marshall({ owner, career: 'c#' + careerId });

    // ---- pull ------------------------------------------------------------
    if (method === 'GET') {
      const r = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: key }));
      if (!r.Item) return json(404, { error: 'not_found' });
      const it = unmarshall(r.Item);
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: it.s3key }));
      const blob = Buffer.from(await obj.Body.transformToByteArray()).toString('base64');
      return json(200, { ...itemOut(it), blob });
    }

    // ---- push ------------------------------------------------------------
    if (method === 'PUT') {
      const body = readBody(event);
      const blob = body.blob;
      if (typeof blob !== 'string' || !blob) return json(400, { error: 'no_blob' });
      if (blob.length > MAX_BLOB) return json(413, { error: 'too_big', max: MAX_BLOB, got: blob.length });
      const baseRev = Number(body.baseRev) || 0;
      const enc = body.enc === 'raw' ? 'raw' : 'gz';
      const meta = cleanMeta(body.meta);
      const device = typeof body.device === 'string' ? body.device.slice(0, 40) : '';
      const bytes = Buffer.from(blob, 'base64');

      // Read the head first: a forced push has to land on top of whatever is actually there,
      // and a successful one needs the superseded object's key to sweep it.
      const headRes = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: key }));
      const cur = headRes.Item ? unmarshall(headRes.Item) : null;
      const rev = (body.force ? (cur ? cur.rev : 0) : baseRev) + 1;
      // The object key is unique PER ATTEMPT, not per revision. Two devices pushing from the
      // same baseRev compute the same rev, so a rev-keyed path would let the loser overwrite —
      // and then, on cleanup, DELETE — the winner's bytes. A per-attempt key makes the losing
      // push physically incapable of touching the save that won.
      const s3key = `saves/${owner.slice(2)}/${careerId}/${rev}-${randomUUID()}.bin`;
      const updatedAt = Date.now();

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: s3key, Body: bytes,
        ContentType: enc === 'gz' ? 'application/gzip' : 'application/json',
      }));

      const item = { owner, career: 'c#' + careerId, rev, s3key, size: bytes.length, enc, meta, device, updatedAt };
      const put = { TableName: TABLE, Item: marshall(item, { removeUndefinedValues: true }) };
      if (!body.force) {
        // First write (baseRev 0) must find nothing; every later write must find exactly baseRev.
        if (baseRev === 0) {
          put.ConditionExpression = 'attribute_not_exists(#o)';
          put.ExpressionAttributeNames = { '#o': 'owner' };
        } else {
          put.ConditionExpression = '#r = :base';
          put.ExpressionAttributeNames = { '#r': 'rev' };
          put.ExpressionAttributeValues = marshall({ ':base': baseRev });
        }
      }

      try {
        await ddb.send(new PutItemCommand(put));
      } catch (e) {
        if (e.name !== 'ConditionalCheckFailedException') throw e;
        // Lost the race. Drop only the object THIS attempt wrote (nothing ever referenced it),
        // then hand back the winning revision so the client can offer a real choice.
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3key })).catch(() => {});
        const now = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: key }));
        return json(409, { error: 'conflict', ...(now.Item ? itemOut(unmarshall(now.Item)) : { rev: 0 }) });
      }

      // Best-effort sweep of the object we just superseded (keeps ~1 live object per career).
      if (cur && cur.s3key && cur.s3key !== s3key) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cur.s3key })).catch(() => {});
      }
      return json(200, { careerId, rev, updatedAt, size: bytes.length });
    }

    // ---- delete ----------------------------------------------------------
    if (method === 'DELETE') {
      const r = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: key }));
      if (r.Item) {
        const it = unmarshall(r.Item);
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: it.s3key })).catch(() => {});
        await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: key }));
      }
      return json(200, { ok: true });
    }

    return json(405, { error: 'method' });
  } catch (e) {
    console.error('sideline-sync', e);
    return json(500, { error: 'server', message: String(e && e.message || e) });
  }
};
