# Sideline cloud saves — backend

One CloudFormation stack: a **Lambda Function URL** in front of a **DynamoDB** slot index
and a private **S3** bucket for the save blobs. The game stays a static file on GitHub
Pages; this is the only server-side piece, and it exists purely so a career can be picked
up on another device.

Deploying is optional. With no endpoint configured the game behaves exactly as before —
`localStorage`, three slots, no network.

---

## Deploy

Prereqs: an AWS account, the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html),
and credentials (`aws configure`).

```bash
cd infra
sam build
sam deploy --guided        # first time only; answers are saved to samconfig.toml
```

At the `--guided` prompts:

| Prompt | Answer |
|---|---|
| Stack Name | `sideline-cloud` |
| AWS Region | whichever is closest to you |
| Parameter AllowOrigin | `*` to start; later `https://<you>.github.io` |
| Confirm changes before deploy | `N` |
| Allow SAM CLI IAM role creation | `Y` |
| Disable rollback | `N` |
| SyncFunction Function URL may not have authorization defined, Is this okay? | **`y`** — auth is the bearer career code, checked inside the handler |
| Save arguments to configuration file | `Y` |

Redeploys after that are just `sam build && sam deploy`.

The stack prints:

```
Key                 ApiUrl
Description         Paste this into the game — Menu → Cloud saves → Endpoint.
Value               https://xxxxxxxxxxxxxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/
```

## Connect the game

1. Open Sideline → **Menu → Cloud saves** (or **Load Game → Cloud**).
2. Paste the `ApiUrl` into **Endpoint**, tap **Connect**.
3. Tap **Create a career code**. You get something like `SIDE-7K2M-9QX4-B8TR`. Copy it.
4. On your other device: same endpoint, then **I have a code** → paste it. Your careers
   appear on the Load screen with a **Download** button.

If you'd rather not paste the endpoint on every device, bake it in: set `CLOUD_ENDPOINT`
near the top of the `CLOUD SAVES` section in `index.html` to your URL and push. The code
still has to be entered per device — that's the part that grants access.

## Cost

Personal use is comfortably inside the perpetual free tier: a mid-career save is ~600 KB
gzipped (a fresh one is smaller; it grows with seasons played), a push is one S3 PUT + one
DynamoDB write, and a heavy session is a few dozen pushes. Storage is ~1 MB per career —
only the live revision is kept. `MaxConcurrency` (default 5) is a hard ceiling on how much
the function can ever run at once.

## Security model

- The **career code** is a 60-bit bearer token (12 Crockford base32 chars) minted in the
  browser from `crypto.getRandomValues`. Whoever has it can read and write those careers —
  it's a namespace key, not an account. Treat it like a password.
- The server never stores the raw code. The DynamoDB partition key is
  `sha256(<per-stack pepper>:<code>)`, so a dump of the table can't be replayed as codes.
- The S3 bucket blocks all public access; only the Lambda role can read or write objects,
  and blobs are never handed out via presigned URLs.
- `AllowOrigin` is a browser-side guard only. The real gate is the code — anything that
  can make an HTTP request can reach the endpoint, and without a valid code it gets a 401.
- There's no registration, so an unknown code isn't an error — it's just an empty
  namespace. That's what makes "type the code on your phone" work with no accounts.

## API

All routes require `Authorization: Bearer <12-char code>` and speak JSON.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/v1/ping` | — | `{ok, version}` |
| `GET` | `/v1/careers` | — | `{careers:[{careerId, rev, size, updatedAt, meta}]}` |
| `GET` | `/v1/careers/{id}` | — | `{careerId, rev, updatedAt, meta, enc, blob}` |
| `PUT` | `/v1/careers/{id}` | `{baseRev, meta, enc, blob, device?, force?}` | `{rev, updatedAt}` or **409** `{error:'conflict', rev, meta, updatedAt}` |
| `DELETE` | `/v1/careers/{id}` | — | `{ok:true}` |

`blob` is base64 of the gzipped, columnar-encoded save (`enc:'gz'`; `'raw'` when the
browser has no `CompressionStream`). Pushes are optimistic: `baseRev` is the revision the
client built on, and the conditional write returns 409 if another device got there first.

Smoke-test a fresh deploy:

```bash
curl -H "Authorization: Bearer 7K2M9QX4B8TR" "$API/v1/ping"
# {"ok":true,"version":1}
```

## Tear down

```bash
sam delete --stack-name sideline-cloud
```

The bucket must be empty first (`aws s3 rm s3://<BucketName> --recursive`). Local
`localStorage` saves are untouched by any of this.
