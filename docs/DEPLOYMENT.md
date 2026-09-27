# Deploying Bursary-Bridge

A production deployment from a clean Ubuntu 22.04 / 24.04 server. Every command
below was run against this repository; where a step can be skipped, it says so
and says what you lose by skipping it.

The application is a single Next.js process talking to PostgreSQL. There is no
message queue, no worker fleet and no cache tier to stand up: bulk imports and
form reading run inside the web process, which is what lets the whole thing
live on one small machine.

---

## 1. What the machine needs

| | Version | Why |
|---|---|---|
| Node.js | 20.x or 22.x LTS | Next.js 15 requires 18.18+; the build is tested on 20 and 22 |
| PostgreSQL | 14 or newer | Developed against 16 |
| RAM | 2 GB minimum | The PDF reader holds a document in memory; 1 GB survives browsing but not a large import |
| Disk | 2 GB, plus uploads | `node_modules` and `.next` are ~1.2 GB together |

```bash
sudo apt update
sudo apt install -y curl git postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && psql --version
```

---

## 2. Create the database

```bash
sudo -u postgres psql -c "CREATE ROLE bursary LOGIN PASSWORD 'choose-a-real-password';"
sudo -u postgres psql -c "CREATE DATABASE bursarybridge OWNER bursary;"
```

The application never needs superuser rights. It owns its own database and
touches nothing else, so this role is deliberately unprivileged.

---

## 3. Get the code

```bash
git clone https://github.com/SCRIPTMASTER67/cursorBursaryBridge.git
cd cursorBursaryBridge
npm ci
```

Use `npm ci`, not `npm install`: it installs exactly the versions in
`package-lock.json`, so the machine you deploy is the machine that was tested.
`postinstall` runs `prisma generate` for you.

---

## 4. Configure the environment

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then edit `.env`. Every variable is validated at startup by `lib/env.ts`, so a
misconfigured deployment fails immediately and says which variable is wrong
rather than throwing on the first request that happens to need it.

**Required:**

```ini
DATABASE_URL="postgresql://bursary:choose-a-real-password@localhost:5432/bursarybridge?schema=public"
AUTH_SECRET="<the 64-character hex string printed above>"
NEXT_PUBLIC_APP_URL="https://bursarybridge.example.ac.za"
NODE_ENV="production"
```

`NEXT_PUBLIC_APP_URL` is baked into the build, because it is what verification
and password-reset links point at. Set it **before** step 6 — changing it later
means rebuilding, not just restarting.

**Email.** The default driver writes messages to the server log, which is fine
for a demonstration and wrong for anything real: every password reset would be
readable only to whoever can tail the log. For a live deployment:

```ini
EMAIL_DRIVER="smtp"
EMAIL_FROM="Bursary-Bridge <no-reply@bursarybridge.example.ac.za>"
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_USER="<username>"
SMTP_PASSWORD="<password>"
SMTP_SECURE="false"   # "true" only on port 465
```

Port 587 negotiates TLS after connecting, so `SMTP_SECURE` stays `false` there;
`true` means TLS from the first byte, which is port 465. A failed send is logged
and the request continues — the in-application notification is already in the
database, and losing the emailed copy must not roll back the record.

**File storage.** Three drivers, chosen by `STORAGE_DRIVER`.

`local` writes uploads to `LOCAL_STORAGE_DIR`, outside `public/`, served only
through a route handler that checks who is asking. Right for a single
long-lived server; point it at a mounted volume, not a directory inside the
checkout, or every document is lost on the next deploy.

`blob` is Vercel Blob, and is what a serverless deployment needs — there the
filesystem is read-only apart from a `/tmp` that belongs to one invocation, so
a document written by one request is simply not there for the request that
reads it back. Linking a Blob store to the project injects
`BLOB_READ_WRITE_TOKEN` and no other configuration is needed. Objects are
stored with Vercel Blob's only access mode, `public`, so the blob URL is
unguessable but not access-controlled — it is therefore never given to a
browser. `urlFor` still points at the application's own route, which checks
the caller and streams the bytes.

`s3` remains a seam whose four methods throw. Do not set it: the upload fails
at runtime, not at startup.

---

## 5. Create the schema and load reference data

```bash
npm run db:deploy
```

`prisma migrate deploy` applies the committed migrations and nothing else. Never
use `db:migrate` or `db:push` against a production database — the first can
prompt to reset, and the second changes the schema without recording a
migration, which leaves the next deployment with no way to know what it is
looking at.

```bash
ADMIN_EMAIL="you@example.ac.za" ADMIN_PASSWORD="<at least 12 characters>" npm run db:seed
```

This creates the institutions, the course catalogue and the NSC subject list —
the lists the profile and eligibility forms choose from — plus the first
administrator. It creates **no** bursaries, funders or applications; those come
only from a funder publishing one or from the ingestion pipeline reading a real
source. Run it again any time: everything is upserted, and the administrator is
only created if that email does not already exist.

Without `ADMIN_PASSWORD` the reference data is still loaded and the seed tells
you no administrator was made. You would then have no way into `/admin`, so set
it.

**Do not run `db:seed:demo` on a production database.** It is invented data —
funders, bursaries and students that do not exist. It refuses to run unless
asked for by name, and a student who saw one of its bursaries would be looking
at something that is not real.

### Optionally, load the bursary directory

```bash
npm run import:snapshot
```

Loads the 189 opportunities already read from their published sources, each with
its source URL and the date it was verified, so every row stays checkable
against the page it came from. It refuses any row without a source URL.

Skip it and the directory starts empty, which is the honest state for a database
that has not ingested anything. To gather them yourself instead, `npm run ingest`
crawls the sources directly — it honours their `robots.txt` and waits thirty
seconds between requests, so it takes hours.

---

## 6. Build

```bash
npm run build
```

The build does not need a reachable database — it is safe to build an image
before the database exists, and the landing page reads its bursary count per
request rather than at build time. It took 54 seconds on the machine this was
written on; a small VPS will take longer. It ends with `✓ Compiled
successfully` and the route table.

---

## 7. Run it

```bash
npm start
```

That serves on port 3000. Use `PORT=8080 npm start` for another port.

As a service, so it survives a reboot — `/etc/systemd/system/bursarybridge.service`:

```ini
[Unit]
Description=Bursary-Bridge
After=network.target postgresql.service

[Service]
Type=simple
User=bursary
WorkingDirectory=/srv/bursarybridge
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bursarybridge
sudo systemctl status bursarybridge
```

`Restart=always` matters more than it looks. Bulk imports run detached from the
upload request, so a restart mid-batch leaves files unread — the batch page
notices after two minutes of no progress and offers **Resume reading**, which
picks up exactly the files that were left.

---

## 8. Put it behind HTTPS

Session cookies are marked `Secure` in production, so **the application will not
log anybody in over plain HTTP.** This step is not optional.

```nginx
server {
    listen 443 ssl;
    server_name bursarybridge.example.ac.za;

    ssl_certificate     /etc/letsencrypt/live/bursarybridge.example.ac.za/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bursarybridge.example.ac.za/privkey.pem;

    # Application forms arrive in batches; the default 1 MB rejects them.
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name bursarybridge.example.ac.za;
    return 301 https://$host$request_uri;
}
```

`X-Forwarded-For` is not decoration: the login rate limiter buckets by client
address, and without it every request arrives as the proxy, so one person
failing a password locks out everybody.

```bash
sudo certbot --nginx -d bursarybridge.example.ac.za
```

---

## 9. Check it is actually up

```bash
curl -s http://localhost:3000/api/health
# {"ok":true,"database":"ok","latencyMs":3}
```

`/api/health` asks the database a real question rather than just proving the
process answered — Next.js serves pages perfectly well while the database is
unreachable, and all of them then fail. It returns 503 when the database does
not answer, which is the endpoint to point a load balancer or `systemd`
watchdog at.

Then, against the running server:

```bash
npm run audit:production
```

This refuses to pass if any user-visible record looks like sample data, and
prints what the directory actually holds. It is the last check before you tell
anybody the site is open.

---

## Deploying to Vercel instead

The steps above stand up one long-lived server. Vercel is the other supported
target, and needs three things the single-server path does not.

**Storage must be `blob`.** See above — on serverless the local disk does not
survive the invocation that wrote to it.

**The database must be reachable from a serverless function**, which means a
pooled connection string. Each invocation opens its own client, so an
unpooled Postgres runs out of connections under very little load. Vercel
Postgres and Neon both hand you a pooled URL; use that one for `DATABASE_URL`.

**Reading happens inside the invocation.** Extraction is started by the upload
request and kept alive past the response by `waitUntil`, bounded by the
route's `maxDuration` — 60 seconds on Hobby, and asking for more there fails
the deployment outright. A batch larger than that is cut short, which is
ordinary rather than exceptional on this platform. Nothing is lost: each
file's state is written as it is read, the progress screen notices two minutes
without progress, and it resumes the unread remainder on its own, up to thirty
times. A large batch therefore finishes in several passes instead of one.

Setting it up:

1. Import the repository at vercel.com and pick this branch.
2. **Storage → Create → Blob**, linked to the project.
3. **Storage → Create → Postgres** (or paste a Neon pooled URL).
4. Set the environment variables:

```ini
DATABASE_URL="<the pooled connection string>"
AUTH_SECRET="<64 hex characters>"
NEXT_PUBLIC_APP_URL="https://your-domain"
STORAGE_DRIVER="blob"
EMAIL_DRIVER="console"
ADMIN_EMAIL="you@example.ac.za"
ADMIN_PASSWORD="<at least 12 characters>"
```

`vercel.json` points the build at `npm run vercel-build`, which applies the
migrations, seeds the catalogue and the administrator, loads the bursary
snapshot and then builds. All of it upserts, so every deploy repeats it
harmlessly and there is no one-off command to run by hand.

Two limits worth knowing before you choose this path. The rate limiter keeps
its counters in memory, so on serverless each instance gets its own budget and
the limit is weaker than it looks. And the ingestion pipeline (`npm run
ingest`) honours a thirty-second crawl delay and runs for hours — it cannot
run inside a function, so refresh the directory from a machine you control and
let the snapshot carry it.

---

## Upgrading a running deployment

```bash
cd /srv/bursarybridge
git pull
npm ci
npm run db:deploy
npm run build
sudo systemctl restart bursarybridge
```

Build before restarting, not after: `npm run build` writes into `.next` while
the old process is still serving from it, so a build that fails leaves the
running site untouched.

Migrations are additive and run before the new code starts, so the old process
keeps working against the new schema for the few seconds between them.

---

## Verifying a deployment

With the server running:

```bash
npm test
```

705 checks across fifteen suites — matching, PDF auto-fill, the catalogue,
results, information requests, letters, bulk import, ingestion, the directory,
three browser suites and a smoke test that opens all 69 pages under a real
session. It needs a reachable database and a running server, and it creates and
deletes its own rows.

Point it at another host with `E2E_BASE_URL=https://staging.example.ac.za npm test`.

The browser suites need Chromium. Set `CHROMIUM_PATH` if it is not at the
default `/opt/pw-browsers/chromium`.

---

## Things that will bite you

**`Invalid environment configuration` on startup.** `lib/env.ts` validated
`.env` and something is missing or malformed. The message names the variable.
This is the intended behaviour — the alternative is failing on whichever
request first needs it.

**`Can't reach database server`.** Check `DATABASE_URL`, then that PostgreSQL is
listening: `sudo -u postgres psql -c "SELECT 1"`. The build does not need the
database, but every request does.

**Sign-in does nothing, no error.** Almost always HTTP rather than HTTPS: the
session cookie is `Secure` in production, so the browser accepts it and then
refuses to send it back. Check `NEXT_PUBLIC_APP_URL` begins `https://`.

**Everyone is rate limited at once.** The proxy is not forwarding
`X-Forwarded-For`, so every request looks like the same client. See step 8.

**Uploads fail at around 1 MB.** `client_max_body_size` in nginx. The
application's own limit is higher, and the import wizard enforces its own cap.

**A verification email never arrives.** With `EMAIL_DRIVER="console"` it never
will — it is in the server log. Check `journalctl -u bursarybridge` and then set
up SMTP.

**An import sits at the same count.** The reader stopped, usually a restart.
Open the batch and use **Resume reading**; it re-reads only what is still
unread.
