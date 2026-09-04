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
    $SUDO apt-get update -qq
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
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

# Next.js 15 needs Node 18.18+; several distributions still ship something
# older, so install Node 20 from NodeSource when the system node is too old.
step 'Checking Node.js'
need_node=1
if command -v node >/dev/null; then
    major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
    [ "$major" -ge 18 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
    echo 'Installing Node.js 20 from NodeSource'
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash - >/dev/null 2>&1 || \
        die 'NodeSource setup failed. Install Node 18+ manually and re-run.'
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
# CREATEDB is not needed to run the app, but `npm run db:migrate` later needs
# it to build its shadow database.
if [ "$("${PG[@]}" psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='bursary'")" != '1' ]; then
    "${PG[@]}" psql -c "CREATE USER bursary WITH PASSWORD 'bursary' CREATEDB;"
fi
if [ "$("${PG[@]}" psql -tAc "SELECT 1 FROM pg_database WHERE datname='bursarybridge'")" != '1' ]; then
    "${PG[@]}" psql -c 'CREATE DATABASE bursarybridge OWNER bursary;'
fi

# --- 3. Source --------------------------------------------------------------
step 'Fetching the source'
[ -d cursorBursaryBridge ] || \
    git clone https://github.com/SCRIPTMASTER67/cursorBursaryBridge.git
cd cursorBursaryBridge

step 'Installing packages (this takes a couple of minutes)'
npm install

# --- 4. Environment ---------------------------------------------------------
# .env is gitignored, so it never arrives with the clone. Write it here in
# full: the DATABASE_URL in .env.example already matches the role and database
# created above, so only the secret has to be filled in.
step 'Writing .env'
[ -f .env ] || cp .env.example .env

secret=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
[ -n "$secret" ] || die 'Could not generate AUTH_SECRET.'
tmp=$(mktemp)
sed "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env > "$tmp" && mv "$tmp" .env

# The placeholder is long enough to pass validation, so a failed substitution
# would not be caught downstream. Check it here instead.
grep -q 'replace-me-with' .env && die 'AUTH_SECRET was not written to .env.'

# --- 5. Schema and demo data ------------------------------------------------
step 'Applying migrations'
npm run db:deploy

step 'Loading demo data'
npm run db:seed

# --- 6. Run -----------------------------------------------------------------
step 'Starting the dev server'
cat <<'BANNER'

  http://localhost:3000  will open once the server is ready.
  student@demo.bursarybridge.local   /  Demo1234!
  corporate@demo.bursarybridge.local /  Demo1234!

  Leave this terminal open. Ctrl+C stops the server.

BANNER

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
