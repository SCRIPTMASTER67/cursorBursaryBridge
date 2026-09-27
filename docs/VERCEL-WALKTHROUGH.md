# Deploying Bursary-Bridge to Vercel

Written for someone who has never used Vercel. Every screen, every field, and
what to type in it. About 20 minutes.

Two things before you start:

- **Everything is on the branch `claude/bursary-bridge-prototype-vhhs5t`**, not
  on `main`. Vercel deploys `main` by default, so there is a step below that
  changes it. Skip that step and you deploy code that does not have any of this
  in it.
- **Step 4's deployment will fail.** That is expected — the database does not
  exist yet. Do not stop there.

Have ready: your GitHub login, and your Namecheap login for the last section.

---

## 1. Create the Vercel account

1. Go to **https://vercel.com** and click **Sign Up**.
2. Choose **Continue with GitHub**.
3. GitHub asks you to authorise Vercel — click **Authorize Vercel**.
4. Vercel asks what kind of account: choose **Hobby** (free).
5. It asks for **Your Name** — type your name. Click **Continue**.

You land on an empty dashboard.

---

## 2. Give Vercel access to the repository

Vercel can only see repositories you let it see.

1. On the dashboard click **Add New…** (top right) → **Project**.
2. You see **Import Git Repository**.
3. If `cursorBursaryBridge` is not listed, click **Adjust GitHub App
   Permissions** (or **Configure GitHub App**).
4. GitHub opens. Under **Repository access**, either leave **All repositories**
   selected, or choose **Only select repositories** and pick
   **cursorBursaryBridge**.
5. Click **Save**. You return to Vercel and the repository now appears.

---

## 3. Import the project

1. Next to **cursorBursaryBridge**, click **Import**.
2. The **Configure Project** screen opens. Leave everything as it is:
   - **Project Name**: `cursorbursarybridge` (or change it — it only affects
     the temporary `.vercel.app` address)
   - **Framework Preset**: should already say **Next.js**. If it says
     *Other*, change it to **Next.js**.
   - **Root Directory**: `./` — leave it.
   - **Build and Output Settings**: leave everything blank. The repository's
     `vercel.json` already tells Vercel what to run.
3. Click **Deploy**.

**This build will fail.** You will see red text and a message about the
database. That is correct at this stage — there is no database yet. Continue to
the next step.

---

## 4. Create the database

1. Click **Continue to Dashboard**, then open the **Storage** tab at the top.
2. Click **Create Database**.
3. Choose **Postgres** (it may be labelled **Neon** — either is correct; it is
   the same Postgres).
4. Fill in:
   - **Database Name**: `bursarybridge`
   - **Region**: pick the one closest to you — `Frankfurt` or `London` from
     South Africa.
5. Click **Create**.
6. When it finishes, find **Connect Project** (or **Connect to Project**),
   choose your project, and confirm.

Connecting injects several variables into the project automatically. You do not
need to copy any of them by hand yet — the next step uses two of them.

---

## 5. Create the file store

Uploaded documents cannot live on Vercel's disk, so they go to Blob storage.

1. Still on the **Storage** tab, click **Create Database** again.
2. Choose **Blob**.
3. **Store Name**: `bursarybridge-uploads`. Click **Create**.
4. **Connect Project** → your project → confirm.

That injects `BLOB_READ_WRITE_TOKEN`. Nothing else to do.

---

## 6. Set the environment variables

1. Open your project (click its name), then **Settings** → **Environment
   Variables**.
2. First, find the values Postgres gave you. In the list you should already see
   names beginning `POSTGRES_`. Click the eye icon to reveal each and copy:
   - the value of **`POSTGRES_PRISMA_URL`** — this is the **pooled** one
   - the value of **`POSTGRES_URL_NON_POOLING`** — this is the **direct** one

   *(If those exact names are not there, use whichever value contains
   `pgbouncer=true` as the pooled one, and the one without it as the direct
   one.)*

3. Now add each variable below. For every one: type the **Key**, paste the
   **Value**, make sure all three boxes — **Production**, **Preview**,
   **Development** — are ticked, then click **Save**.

| Key | Value |
|---|---|
| `DATABASE_URL` | paste the **`POSTGRES_PRISMA_URL`** value |
| `DIRECT_DATABASE_URL` | paste the **`POSTGRES_URL_NON_POOLING`** value |
| `AUTH_SECRET` | `f2a1226f92534a81f03b4a529f23e7773dee4a7a46021c97e00de106bde5c8bd` |
| `NEXT_PUBLIC_APP_URL` | `https://bursarybridge.com` |
| `STORAGE_DRIVER` | `blob` |
| `EMAIL_DRIVER` | `console` |
| `EMAIL_FROM` | `Bursary-Bridge <no-reply@bursarybridge.com>` |
| `ADMIN_EMAIL` | your email address |
| `ADMIN_PASSWORD` | a password you choose — **at least 12 characters** |

Why the two database URLs differ: the application opens a new connection on
every request, so it uses the **pooled** one or it runs out of connections.
Database migrations cannot run through a pooler at all, so they use the
**direct** one. Getting these the wrong way round is the most common way this
deployment fails.

Write your `ADMIN_PASSWORD` down. It is how you sign in, and it is not shown
again.

---

## 7. Switch to the right branch

**Do not skip this.** Without it you deploy `main`, which has none of this work.

1. **Settings** → **Git**.
2. Find **Production Branch**. It says `main`.
3. Change it to:

```
claude/bursary-bridge-prototype-vhhs5t
```

4. Click **Save**.

---

## 8. Deploy properly

1. Go to the **Deployments** tab.
2. Click the **⋯** menu on the most recent (failed) deployment → **Redeploy**.
3. In the dialog, **untick "Use existing Build Cache"**, then click
   **Redeploy**.
4. Watch the log. It takes 3–6 minutes. You should see, in order:
   - `9 migrations found` … `All migrations have been successfully applied`
   - `administrator: created <your email>`
   - `189 created, 0 updated, 0 refused`
   - `✓ Compiled successfully`
   - **Ready**

When it says **Ready**, click **Visit**. The site is live on a
`…vercel.app` address.

Sign in at `/login` with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set.

---

## 9. Point your domain at it

1. **Settings** → **Domains**.
2. Type `bursarybridge.com` and click **Add**.
3. Choose **Add `bursarybridge.com` and redirect `www` to it** (the
   recommended option).
4. Vercel shows the DNS records it needs. Keep this tab open.

Now in Namecheap:

5. Sign in → **Domain List** → **Manage** next to `bursarybridge.com`.
6. Open the **Advanced DNS** tab.
7. **Delete any existing records first** — Namecheap adds a parking page
   `CNAME` for `www` and a `URL Redirect` for `@`. Both must go, or they fight
   your new records.
8. Click **Add New Record** and create exactly what Vercel showed you. It is
   normally these two:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `76.76.21.21` | Automatic |
| CNAME Record | `www` | `cname.vercel-dns.com.` | Automatic |

   **Use the values on your Vercel screen if they differ from these** — Vercel
   is authoritative, this table is only the usual case.

9. Click the green tick to save each record.
10. Back on Vercel, the domain shows **Invalid Configuration** until DNS
    spreads. This takes 10 minutes to a few hours. Click **Refresh**
    occasionally. When it turns to **Valid Configuration**, HTTPS is issued
    automatically and `https://bursarybridge.com` works.

---

## If something goes wrong

**The build fails on `Environment variable not found: DIRECT_DATABASE_URL`.**
Step 6 was missed or misspelt. The name must match exactly.

**The build fails on `Can't reach database server` or a migration error.**
`DIRECT_DATABASE_URL` is probably holding the pooled value. It must be the
**non-pooling** one.

**The site loads but sign-in does nothing.** Check `NEXT_PUBLIC_APP_URL`
matches the address you are actually visiting, and begins `https://`. The
session cookie is marked Secure, so the browser accepts it and then refuses to
send it back over anything else. Changing this variable needs a **redeploy**,
not just a save — it is built into the site.

**Sign-in says the details are wrong.** The administrator is created by the
build, so it only exists if the deployment that set `ADMIN_PASSWORD` succeeded.
Check the build log for `administrator: created`. If it says *not created*, add
`ADMIN_PASSWORD` and redeploy.

**Uploading a document fails.** `STORAGE_DRIVER` must be exactly `blob`, and
the Blob store must be connected to this project (Storage tab → the store →
Connected Projects).

**The bursary directory is empty.** The build log will say how many were
loaded. `189 created` means it worked; if that line is missing the seed step
did not run, so redeploy without the build cache.

**A bulk import stops part way.** Expected on Vercel and handled: functions are
capped at 60 seconds on the free plan, so a large batch is read in several
passes. The progress screen notices and continues on its own. Leave the page
open.

---

## What this deployment cannot do

Stated plainly so nothing surprises you in front of an examiner.

- **Emails are not sent.** `EMAIL_DRIVER=console` writes them to the Vercel log
  instead. Password reset therefore cannot be completed by a user on their own.
  To change that, set `EMAIL_DRIVER=smtp` and add `SMTP_HOST`, `SMTP_PORT=587`,
  `SMTP_USER` and `SMTP_PASSWORD` from any mail provider.
- **The rate limiter counts in memory**, so each serverless instance has its
  own budget and the limit is weaker than on a single server.
- **The bursary crawler cannot run here.** It honours a thirty-second delay
  between requests and runs for hours. Run `npm run ingest` on your own
  machine; the deployment carries the 189 already collected.
