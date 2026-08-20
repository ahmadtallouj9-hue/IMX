# Prepare the backend: install deps, generate Prisma client, apply migrations.
Set-Location (Join-Path $PSScriptRoot "..\server")

npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example — please review and edit values."
}

npx prisma migrate dev
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Backend ready. Run 'npm run dev' inside server/ to start."
