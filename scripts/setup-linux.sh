#!/usr/bin/env bash
#
# Bursary-Bridge - one-shot setup on a clean Linux machine.
#
# Installs Node, PostgreSQL and Git, creates the database role and database,
# clones the repository, writes a complete .env (including a freshly generated
# AUTH_SECRET), applies the migrations, loads the demo data, starts the dev
# server and opens the browser.
#
# Unlike Windows there is no password to hunt for: PostgreSQL trusts the
# postgres system account over the local socket, so the role is created through
# `sudo -u postgres` and never needs a superuser password.
#
# Safe to re-run: every step checks whether it has already been done.

set -euo pipefail

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
die()  { printf '\n\033[31mError: %s\033[0m\n' "$1" >&2; exit 1; }

# SUDO escalates privilege; PG runs a command as the postgres system user.
# These are separate because `$SUDO -u postgres` collapses to a bare `-u` when
# SUDO is empty, which is exactly the case when the script runs as root.
SUDO=''
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null || die 'Not root and sudo is not installed.'
    SUDO='sudo'
    PG=(sudo -u postgres)
elif command -v runuser >/dev/null; then
    PG=(runuser -u postgres --)
else
    PG=(su postgres -c)
fi

# --- 1. Prerequisites -------------------------------------------------------
step 'Installing Git, curl and PostgreSQL'
if   command -v apt-get >/dev/null; then
    $SUDO apt-get update -qq || true
    # `env` rather than a bare assignment: bash recognises assignments at parse
    # time, so with $SUDO empty (running as root) the assignment would be read
    # as the command name and fail with "command not found".
    $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        git curl ca-certificates postgresql postgresql-contrib
elif command -v dnf >/dev/null; then
    $SUDO dnf install -y git curl postgresql-server postgresql-contrib
    [ -s /var/lib/pgsql/data/PG_VERSION ] || $SUDO postgresql-setup --initdb
elif command -v pacman >/dev/null; then
    $SUDO pacman -Sy --noconfirm git curl postgresql
    [ -s /var/lib/postgres/data/PG_VERSION ] || \
        "${PG[@]}" initdb -D /var/lib/postgres/data
else
    die 'No supported package manager found (apt-get, dnf or pacman).'
fi

# Next.js 15 needs Node 18.18+, but Playwright requires Node 20 or newer, so 20
# is the real floor for this project. Ubuntu 24.04 ships 18, which clears the
# Next.js bar and then warns on every install, so check for 20.
step 'Checking Node.js'
need_node=1
if command -v node >/dev/null; then
    major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
    [ "$major" -ge 20 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
    echo "Installing Node.js 20 from NodeSource (found ${major:-none}, need 20+)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash - >/dev/null 2>&1 || \
        die 'NodeSource setup failed. Install Node 20+ manually and re-run.'
    $SUDO apt-get install -y -qq nodejs
else
    echo "Using $(node -v)"
fi

# --- 2. Database ------------------------------------------------------------
step 'Starting PostgreSQL'
if command -v pg_ctlcluster >/dev/null && pg_lsclusters -h 2>/dev/null | grep -q down; then
    # Debian/Ubuntu, and no systemd (containers, WSL): start the cluster directly
    ver=$(pg_lsclusters -h | awk '$4=="down"{print $1; exit}')
    cl=$(pg_lsclusters  -h | awk '$4=="down"{print $2; exit}')
    $SUDO pg_ctlcluster "$ver" "$cl" start || true
fi
$SUDO systemctl enable --now postgresql >/dev/null 2>&1 || \
    $SUDO service postgresql start >/dev/null 2>&1 || true

for _ in $(seq 1 20); do
    "${PG[@]}" psql -tAc 'SELECT 1' >/dev/null 2>&1 && break
    sleep 2
done
"${PG[@]}" psql -tAc 'SELECT 1' >/dev/null 2>&1 || \
    die 'PostgreSQL is installed but not accepting connections.'

step 'Creating the role and database'
# Overridable, so a second instance — a test run, a scratch copy — can be set
# up beside an existing one without the two sharing a database. Anything that
# drops or reseeds one then cannot reach into the other.
DB_NAME=${DB_NAME:-bursarybridge}
DB_USER=${DB_USER:-bursary}
DB_PASSWORD=${DB_PASSWORD:-bursary}

# CREATEDB is not needed to run the app, but `npm run db:migrate` later needs
# it to build its shadow database.
if [ "$("${PG[@]}" psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" != '1' ]; then
    "${PG[@]}" psql -c "CREATE USER \"$DB_USER\" WITH PASSWORD '$DB_PASSWORD' CREATEDB;"
fi
if [ "$("${PG[@]}" psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" != '1' ]; then
    "${PG[@]}" psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
fi

# --- 3. Source --------------------------------------------------------------
# The work lives on a branch, not on the default one, so the branch is named
# explicitly. Cloning without it silently produces a different application:
# older migrations, an older seed, and errors that look like configuration
# problems rather than the wrong code.
REPO=${REPO:-https://github.com/SCRIPTMASTER67/cursorBursaryBridge.git}
BRANCH=${BRANCH:-claude/bursary-bridge-prototype-vhhs5t}

step "Fetching the source ($BRANCH)"
if [ -d cursorBursaryBridge/.git ]; then
    # An existing clone may be on another branch or out of date. Bring it to
    # the right one rather than building on whatever happens to be there.
    cd cursorBursaryBridge
    git fetch origin "$BRANCH" --depth=1 || die "Could not fetch $BRANCH."

    # Clear the way for the checkout below, which refuses to run over a
    # modified tracked file and takes the whole script down with it.
    #
    # package-lock.json is the one that actually shows up. npm rewrites it
    # whenever its own version differs from the one that wrote it, so a first
    # run leaves it modified and the second run dies on a file the script
    # itself changed. It is discarded rather than kept: the committed lockfile
    # is the one the branch was tested with, which is the entire point of it.
    git checkout -- package-lock.json 2>/dev/null || true

    # Anything else belongs to whoever is at this machine. It is set aside
    # where they can get it back, never dropped.
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        git stash push --quiet --message "setup-linux.sh $(date '+%Y-%m-%d %H:%M')" \
            || die 'Could not set aside your local changes. Commit or stash them, then re-run.'
        printf '  Your local changes were set aside. Restore them with: git stash pop\n'
    fi

    git checkout -B "$BRANCH" "origin/$BRANCH" || die "Could not switch to $BRANCH."
else
    git clone --branch "$BRANCH" "$REPO" || die "Could not clone $BRANCH from $REPO."
    cd cursorBursaryBridge
fi

on=$(git rev-parse --abbrev-ref HEAD)
[ "$on" = "$BRANCH" ] || die "Expected to be on $BRANCH but am on $on."
echo "On $on at $(git rev-parse --short HEAD)"

# A quick sanity check on what actually arrived. If these are missing the
# clone is not the branch this script was written for, and every later step
# would fail in a way that points at the wrong thing.
[ -f prisma/seed-demo.ts ] || die 'This clone does not contain prisma/seed-demo.ts. Wrong branch?'
[ -f lib/ingest/pipeline.ts ] || die 'This clone does not contain lib/ingest. Wrong branch?'

# `npm ci` rather than `npm install`: it installs exactly the versions in
# package-lock.json, so this machine gets the tree the branch was tested with,
# and -- unlike `npm install` -- it never rewrites the lockfile, which is what
# left the working tree dirty and blocked the checkout above on a second run.
# It needs the lockfile to agree with package.json; if it does not, or a
# platform-specific package has no entry for this machine, fall back rather
# than stopping, and say which one ran.
step 'Installing packages (this takes a couple of minutes)'
if ! npm ci; then
    printf '\n  npm ci did not succeed; falling back to npm install.\n\n'
    npm install || die 'Could not install the packages.'
fi

# Generate the Prisma client explicitly rather than relying on the install to
# do it. On a re-run over an existing clone npm has nothing to install, so it
# runs no lifecycle scripts, and the client left over from the previous run
# still describes the previous schema. The failure that causes is a long way
# from its cause: the migrations apply cleanly, and then the seed dies on
# "Unknown argument `canonicalName`" because the client has never heard of a
# column the database now has.
step 'Generating the database client'
npx --yes prisma generate

# --- 4. Environment ---------------------------------------------------------
# .env is gitignored, so it never arrives with the clone. Write it here in
# full: the DATABASE_URL in .env.example already matches the role and database
# created above, so only the secret has to be filled in.
step 'Writing .env'
[ -f .env ] || cp .env.example .env

# The database this instance talks to, which is only the default when nothing
# was overridden above.
tmp=$(mktemp)
sed "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public\"|" .env > "$tmp" && mv "$tmp" .env

secret=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
[ -n "$secret" ] || die 'Could not generate AUTH_SECRET.'
tmp=$(mktemp)
sed "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env > "$tmp" && mv "$tmp" .env

# The placeholder is long enough to pass validation, so a failed substitution
# would not be caught downstream. Check it here instead.
grep -q 'replace-me-with' .env && die 'AUTH_SECRET was not written to .env.'

# --- 5. Schema and data -----------------------------------------------------
step 'Applying migrations'
npm run db:deploy

# Demo data is a separate, explicitly-requested step. Every funder and bursary
# it creates is INVENTED, which is why it refuses to run without being asked by
# name and refuses outright when NODE_ENV is production. Skip it with
# SKIP_DEMO_DATA=1 for an empty directory, which is what a real deployment has.
#
# It runs BEFORE the production seed because it truncates the database, so
# running it second would wipe the administrator the production seed creates.
if [ "${SKIP_DEMO_DATA:-0}" = '1' ]; then
    step 'Skipping demo data (SKIP_DEMO_DATA=1)'
else
    step 'Loading demo data — every bursary it creates is invented'
    SEED_DEMO_DATA=yes npm run db:seed:demo
fi

# Real opportunities, collected by the ingestion pipeline and exported as a
# snapshot. Each one carries the URL it was read from and the date it was last
# confirmed, so it stays checkable — unlike the demo data above, none of this
# was written by hand. Skip it with SKIP_REAL_DATA=1 for a genuinely empty
# directory.
if [ "${SKIP_REAL_DATA:-0}" = '1' ]; then
    step 'Skipping the bursary snapshot (SKIP_REAL_DATA=1)'
elif [ -f prisma/opportunities-snapshot.json ]; then
    step 'Loading real bursaries collected from published sources'
    npm run import:snapshot
fi

# The production seed creates reference data only: the institution and course
# catalogue the forms choose from, plus the first administrator. It creates no
# bursaries, because a seeded bursary is an invented bursary. It upserts, so it
# is safe to run over the demo data.
step 'Loading the institution and course catalogue, and the administrator'
ADMIN_EMAIL=admin@bursarybridge.local ADMIN_PASSWORD='ChangeMe-Locally-1' npm run db:seed

# --- 6. Run -----------------------------------------------------------------
step 'Starting the dev server'
if [ "${SKIP_DEMO_DATA:-0}" = '1' ]; then
cat <<'BANNER'

  http://localhost:3000  will open once the server is ready.
  admin@bursarybridge.local  /  ChangeMe-Locally-1

  All Bursaries holds real bursaries collected from published sources. Every
  one shows the page it was read from and the date it was last confirmed.
  To refresh them against the live sources (slow: the sources ask for a
  30-second gap between requests, and we honour it):
    npm run ingest

  Leave this terminal open. Ctrl+C stops the server.

BANNER
else
cat <<'BANNER'

  http://localhost:3000  will open once the server is ready.
  student@demo.bursarybridge.local   /  Demo1234!
  corporate@demo.bursarybridge.local /  Demo1234!
  admin@bursarybridge.local          /  ChangeMe-Locally-1

  The bursaries you will see are INVENTED demo data for local evaluation.
  Remove them at any time with:  npm run purge:mock

  Leave this terminal open. Ctrl+C stops the server.

BANNER
fi

# Open a browser once the port answers. Harmless on a headless machine.
(
    for _ in $(seq 1 150); do
        if (exec 3<>/dev/tcp/127.0.0.1/3000) 2>/dev/null; then
            exec 3<&- 3>&-
            sleep 3   # let the first page compile
            xdg-open http://localhost:3000 >/dev/null 2>&1 || true
            exit 0
        fi
        sleep 2
    done
) &

npm run dev
