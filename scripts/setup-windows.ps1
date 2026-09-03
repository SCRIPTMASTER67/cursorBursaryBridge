<#
    Bursary-Bridge - one-shot setup for a clean Windows machine.

    Installs Node, PostgreSQL and Git, creates the database role and database,
    clones the repository, writes a complete .env (including a freshly
    generated AUTH_SECRET), applies the migrations, loads the demo data, starts
    the dev server and opens the browser.

    The only thing it asks for is the PostgreSQL superuser password.

    Safe to re-run: every step checks whether it has already been done.
#>

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

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
    throw 'Could not connect as "postgres" - wrong password, or the service has not started.'
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
Step 'Fetching the source'
if (-not (Test-Path 'cursorBursaryBridge')) {
    git clone https://github.com/SCRIPTMASTER67/cursorBursaryBridge.git
}
Set-Location 'cursorBursaryBridge'

Step 'Installing packages (this takes a couple of minutes)'
npm install

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

# --- 5. Schema and demo data ------------------------------------------------
Step 'Applying migrations'
npm run db:deploy

Step 'Loading demo data'
npm run db:seed

# --- 6. Run -----------------------------------------------------------------
Step 'Starting the dev server'
Write-Host ''
Write-Host '  http://localhost:3000  will open once the server is ready.' -ForegroundColor Green
Write-Host '  student@demo.bursarybridge.local   /  Demo1234!' -ForegroundColor Green
Write-Host '  corporate@demo.bursarybridge.local /  Demo1234!' -ForegroundColor Green
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
