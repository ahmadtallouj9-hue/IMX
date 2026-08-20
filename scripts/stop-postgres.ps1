# Stop the portable PostgreSQL instance if running.
$tools = Join-Path $PSScriptRoot '..\tools'
$pg = Join-Path $tools 'pgsql\bin'
$data = Join-Path $tools 'pgdata'

if (Test-Path (Join-Path $data 'PG_VERSION')) {
    & (Join-Path $pg 'pg_ctl.exe') -D $data stop -m fast 2>$null
    Write-Host "PostgreSQL stopped."
} else {
    Write-Host "No data directory found."
}
