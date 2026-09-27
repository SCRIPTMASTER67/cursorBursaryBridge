<#
    Bursary-Bridge - one-shot setup for a clean Windows machine.

    Installs Node, PostgreSQL and Git, creates the database role and database,
    clones the project branch, writes a complete .env (including a freshly
    generated AUTH_SECRET), applies the migrations, loads the data, starts the
    dev server and opens the browser.

    Skip the invented demo data with:  $env:SKIP_DEMO_DATA = '1'
    Skip the real bursary snapshot with:  $env:SKIP_REAL_DATA = '1'

    The only thing it asks for is the PostgreSQL superuser password.

    Safe to re-run: every step checks whether it has already been done.
#>

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# $ErrorActionPreference does not apply to native commands such as git and npm:
# they signal failure through the exit code, which PowerShell will otherwise
# walk straight past. Every call that must succeed is followed by this.
function Assert-Ok($msg) { if ($LASTEXITCODE -ne 0) { throw $msg } }

# --- 0. Let PowerShell run the npm shim ------------------------------------
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force

# --- 1. Prerequisites -------------------------------------------------------
Step "Installing Node.js, PostgreSQL and Git"
foreach ($id in 'OpenJS.NodeJS.LTS', 'PostgreSQL.PostgreSQL.17', 'Git.Git') {
    winget install -e --id $id --accept-source-agreements --accept-package-agreements
}

# Pick up the PATH the installers just wrote, without reopening the shell.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path', 'User')

# psql is not added to PATH by the installer, and the version folder varies.
$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw 'psql.exe not found. Did the PostgreSQL install succeed?' }
$env:Path += ';' + $psql.DirectoryName

# --- 2. Database ------------------------------------------------------------
Step 'Connecting to PostgreSQL'
Write-Host "Enter the postgres superuser password you chose during install."
Write-Host "If the installer never asked, try: postgres"
$sec = Read-Host 'postgres password' -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

$connected = $false
foreach ($i in 1..15) {
    psql -U postgres -tAc 'SELECT 1' *> $null
    if ($LASTEXITCODE -eq 0) { $connected = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $connected) {
    Write-Host ''
    Write-Host 'Password authentication failed for user "postgres".' -ForegroundColor Red
    Write-Host ''
    Write-Host 'PostgreSQL has no password recovery, but the password can be reset.'
    Write-Host 'Open PowerShell AS ADMINISTRATOR, run this, then start over:'
    Write-Host ''
    Write-Host '  irm https://raw.githubusercontent.com/SCRIPTMASTER67/cursorBursaryBridge/claude/bursary-bridge-prototype-vhhs5t/scripts/fix-postgres-password.ps1 | iex' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'That sets the postgres password to: postgres'
    throw 'Cannot continue without the postgres password.'
}

Step 'Creating the role and database'
if ((psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='bursary'") -ne '1') {
    # CREATEDB is not needed to run the app, but `npm run db:migrate` later
    # needs it to build its shadow database.
    psql -U postgres -c "CREATE USER bursary WITH PASSWORD 'bursary' CREATEDB;"
}
if ((psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bursarybridge'") -ne '1') {
    psql -U postgres -c 'CREATE DATABASE bursarybridge OWNER bursary;'
}

# --- 3. Source --------------------------------------------------------------
# The work lives on a branch, not on the default one, so the branch is named
# explicitly. Cloning without it silently produces a different application:
# older migrations, an older seed, and errors that look like configuration
# problems rather than the wrong code.
$repo   = 'https://github.com/SCRIPTMASTER67/cursorBursaryBridge.git'
$branch = 'claude/bursary-bridge-prototype-vhhs5t'

Step "Fetching the source ($branch)"
if (Test-Path 'cursorBursaryBridge\.git') {
    # An existing clone may be on another branch or out of date. Bring it to
    # the right one rather than building on whatever happens to be there.
    Set-Location 'cursorBursaryBridge'
    git fetch origin $branch --depth=1
    Assert-Ok "Could not fetch $branch."

    # Clear the way for the checkout below, which refuses to run over a
    # modified tracked file. package-lock.json is the one that shows up: npm
    # rewrites it whenever its own version differs from the one that wrote it,
    # so a first run leaves it modified and the second run dies on a file this
    # script itself changed. The committed lockfile is the authoritative one.
    # *> $null, not 2>$null: with $ErrorActionPreference = 'Stop', PowerShell 5.1
    # can turn a native command's stderr into a terminating error, and git
    # writes to stderr even when it succeeds.
    git checkout -- package-lock.json *> $null

    # Anything else belongs to whoever is at this machine. It is set aside
    # where they can get it back, never dropped.
    if (git status --porcelain --untracked-files=no) {
        git stash push --quiet --message "setup-windows.ps1 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        Assert-Ok 'Could not set aside your local changes. Commit or stash them, then re-run.'
        Write-Host '  Your local changes were set aside. Restore them with: git stash pop'
    }

    git checkout -B $branch "origin/$branch"
    Assert-Ok "Could not switch to $branch."
} else {
    git clone --branch $branch $repo
    Assert-Ok "Could not clone $branch from $repo."
    Set-Location 'cursorBursaryBridge'
}

# A quick sanity check on what actually arrived. If these are missing the
# clone is not the branch this script was written for, and every later step
# would fail in a way that points at the wrong thing.
foreach ($f in 'prisma/seed-demo.ts', 'lib/ingest/pipeline.ts') {
    if (-not (Test-Path $f)) { throw "This clone does not contain $f. Wrong branch?" }
}

# `npm ci` rather than `npm install`: it installs exactly the versions in
# package-lock.json, so this machine gets the tree the branch was tested with,
# and unlike `npm install` it never rewrites the lockfile, which is what left
# the working tree dirty and blocked the checkout above on a second run.
Step 'Installing packages (this takes a couple of minutes)'
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '  npm ci did not succeed; falling back to npm install.' -ForegroundColor Yellow
    Write-Host ''
    npm install
    Assert-Ok 'Could not install the packages.'
}

# Generate the Prisma client explicitly rather than relying on the install to
# do it. On a re-run over an existing clone npm may have nothing to install, so
# it runs no lifecycle scripts, and the client left over from the previous run
# still describes the previous schema. The failure that causes is a long way
# from its cause: the migrations apply cleanly, and then the seed dies on
# "Unknown argument" because the client has never heard of a column the
# database now has.
Step 'Generating the database client'
npx --yes prisma generate
Assert-Ok 'Could not generate the Prisma client.'

# --- 4. Environment ---------------------------------------------------------
# .env is gitignored, so it never arrives with the clone. Write it here in
# full: the DATABASE_URL in .env.example already matches the role and database
# created above, so only the secret has to be filled in.
Step 'Writing .env'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }

$secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
if (-not $secret) { throw 'Could not generate AUTH_SECRET - is node on PATH?' }

$envText = (Get-Content '.env') -replace '^AUTH_SECRET=.*', ('AUTH_SECRET="' + $secret + '"')
Set-Content -Path '.env' -Value $envText -Encoding ascii

# The placeholder is long enough to pass validation, so a failed substitution
# would not be caught downstream. Check it here instead.
if (Select-String -Path '.env' -Pattern 'replace-me-with' -Quiet) {
    throw 'AUTH_SECRET was not written to .env.'
}

# --- 5. Schema and data -----------------------------------------------------
Step 'Applying migrations'
npm run db:deploy
Assert-Ok 'Could not apply the migrations.'

# Demo data is a separate, explicitly-requested step. Every funder and bursary
# it creates is INVENTED, which is why it refuses to run without being asked by
# name. Skip it with $env:SKIP_DEMO_DATA = '1' for an empty directory, which is
# what a real deployment has.
#
# It runs BEFORE the production seed because it truncates the database, so
# running it second would wipe the administrator the production seed creates.
if ($env:SKIP_DEMO_DATA -eq '1') {
    Step 'Skipping demo data (SKIP_DEMO_DATA=1)'
} else {
    Step 'Loading demo data - every bursary it creates is invented'
    $env:SEED_DEMO_DATA = 'yes'
    npm run db:seed:demo
    Assert-Ok 'Could not load the demo data.'
}

# Real opportunities, collected by the ingestion pipeline and exported as a
# snapshot. Each one carries the URL it was read from and the date it was last
# confirmed, so it stays checkable - unlike the demo data above, none of this
# was written by hand.
if ($env:SKIP_REAL_DATA -eq '1') {
    Step 'Skipping the bursary snapshot (SKIP_REAL_DATA=1)'
} elseif (Test-Path 'prisma/opportunities-snapshot.json') {
    Step 'Loading real bursaries collected from published sources'
    npm run import:snapshot
    Assert-Ok 'Could not load the bursary snapshot.'
}

# The production seed creates reference data only: the institution and course
# catalogue the forms choose from, plus the first administrator. It creates no
# bursaries, because a seeded bursary is an invented bursary. It upserts, so it
# is safe to run over the demo data.
#
# ADMIN_PASSWORD must be set, or the seed loads the catalogue and creates no
# administrator at all - which leaves no way into /admin.
Step 'Loading the institution and course catalogue, and the administrator'
$env:ADMIN_EMAIL    = 'admin@bursarybridge.local'
$env:ADMIN_PASSWORD = 'ChangeMe-Locally-1'
npm run db:seed
Assert-Ok 'Could not load the catalogue and administrator.'

# --- 6. Run -----------------------------------------------------------------
Step 'Starting the dev server'
Write-Host ''
Write-Host '  http://localhost:3000  will open once the server is ready.' -ForegroundColor Green
Write-Host ''
if ($env:SKIP_DEMO_DATA -eq '1') {
    Write-Host '  admin@bursarybridge.local  /  ChangeMe-Locally-1' -ForegroundColor Green
    Write-Host ''
    Write-Host '  All Bursaries holds real bursaries collected from published sources.'
    Write-Host '  Every one shows the page it was read from and when it was confirmed.'
} else {
    Write-Host '  student@demo.bursarybridge.local    /  Demo1234!' -ForegroundColor Green
    Write-Host '  corporate@demo.bursarybridge.local  /  Demo1234!' -ForegroundColor Green
    Write-Host '  admin@bursarybridge.local           /  ChangeMe-Locally-1' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Some of the bursaries you will see are INVENTED demo data.'
    Write-Host '  Remove them at any time with:  npm run purge:mock'
}
Write-Host ''
Write-Host '  Leave this window open. Ctrl+C stops the server.'
Write-Host ''

Start-Job {
    foreach ($i in 1..150) {
        $client = New-Object Net.Sockets.TcpClient
        try {
            $client.Connect('localhost', 3000)
            $client.Close()
            Start-Sleep -Seconds 3   # let the first page compile
            Start-Process 'http://localhost:3000'
            return
        } catch { Start-Sleep -Seconds 2 }
    }
} | Out-Null

npm run dev
