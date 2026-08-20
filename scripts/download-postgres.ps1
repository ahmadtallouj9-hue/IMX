# Downloads portable PostgreSQL binaries (run in background, no admin needed).
$ErrorActionPreference = 'Stop'

$tools = 'C:\Users\ahmad\chatter\tools'
$zip = Join-Path $tools 'postgresql-16.4-1-windows-x64-binaries.zip'
$url = 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip'

New-Item -ItemType Directory -Force -Path $tools | Out-Null

if (-not (Test-Path $zip)) {
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
}

if (-not (Test-Path (Join-Path $tools 'pgsql\bin\initdb.exe'))) {
    tar -xf $zip -C $tools
}

if (Test-Path (Join-Path $tools 'pgsql\bin\initdb.exe')) {
    Set-Content -Path (Join-Path $tools 'PG_READY') -Value (Get-Date)
}
