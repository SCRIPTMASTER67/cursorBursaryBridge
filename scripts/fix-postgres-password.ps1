<#
    Reset the PostgreSQL "postgres" superuser password to: postgres

    Use this when the installer never told you the password, or it was set to
    something forgotten. PostgreSQL has no recovery mechanism, so the only way
    in is to briefly tell the server to trust local connections, change the
    password, and put the original rules straight back.

    MUST be run from an Administrator PowerShell: pg_hba.conf lives under
    Program Files and the service has to be restarted.
#>

$ErrorActionPreference = 'Stop'
$NewPassword = 'postgres'

$isAdmin = ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw 'Run this from an Administrator PowerShell (right-click PowerShell -> Run as administrator).'
}

$hba = Get-ChildItem 'C:\Program Files\PostgreSQL\*\data\pg_hba.conf' -ErrorAction SilentlyContinue |
       Sort-Object FullName -Descending | Select-Object -First 1
if (-not $hba) { throw 'pg_hba.conf not found - is PostgreSQL installed under C:\Program Files?' }

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw 'psql.exe not found.' }

$svc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $svc) { throw 'No PostgreSQL service found.' }

Write-Host "Using $($hba.FullName)"
Write-Host "Service: $($svc.Name)"

$backup = "$($hba.FullName).bak"
Copy-Item $hba.FullName $backup -Force
Write-Host "Original rules backed up to $backup"

try {
    # --- open the door -----------------------------------------------------
    $patched = foreach ($line in Get-Content $hba.FullName) {
        if ($line -match '^\s*(local|host|hostssl|hostnossl)\s') {
            $line -replace '(scram-sha-256|md5|password|ident|sspi|gss|peer|cert)\s*$', 'trust'
        } else { $line }
    }
    Set-Content -Path $hba.FullName -Value $patched -Encoding ascii

    Restart-Service $svc.Name
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

    $up = $false
    foreach ($i in 1..15) {
        & $psql.FullName -U postgres -tAc 'SELECT 1' *> $null
        if ($LASTEXITCODE -eq 0) { $up = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $up) { throw 'Server did not come back up in trust mode.' }

    & $psql.FullName -U postgres -c "ALTER USER postgres PASSWORD '$NewPassword';"
    if ($LASTEXITCODE -ne 0) { throw 'Could not set the password.' }
}
finally {
    # --- and shut it again, whatever happened above ------------------------
    Copy-Item $backup $hba.FullName -Force
    Restart-Service $svc.Name
    Write-Host 'Original authentication rules restored.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host "The postgres password is now: $NewPassword" -ForegroundColor Green
Write-Host 'Re-run the setup command and enter that when prompted.'
