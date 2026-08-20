# Initialize and start a portable PostgreSQL instance (no admin/service needed).
$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot '..'
$tools = Join-Path $root 'tools'
$pg = Join-Path $tools 'pgsql\bin'
$data = Join-Path $tools 'pgdata'
$port = 5433

if (-not (Test-Path (Join-Path $pg 'initdb.exe'))) {
    throw "PostgreSQL binaries not found. Run scripts\download-postgres.ps1 first."
}

if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    Write-Host "Initializing PostgreSQL data directory..."
    & (Join-Path $pg 'initdb.exe') -D $data -U chatter --auth=trust --encoding=UTF8 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "initdb failed" }
}

# Start if not already running.
& (Join-Path $pg 'pg_ctl.exe') -D $data status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting PostgreSQL on port $port..."
    & (Join-Path $pg 'pg_ctl.exe') -D $data -l (Join-Path $tools 'postgres.log') -o "-p $port" start | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_ctl start failed" }
}

# Wait for readiness, then create databases.
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    & (Join-Path $pg 'pg_isready.exe') -h localhost -p $port *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 1000
}
if (-not $ready) { throw "PostgreSQL did not become ready" }

& (Join-Path $pg 'createdb.exe') -h localhost -p $port -U chatter chatter 2>$null
& (Join-Path $pg 'createdb.exe') -h localhost -p $port -U chatter chatter_test 2>$null

Write-Host "PostgreSQL ready on localhost:$port"
