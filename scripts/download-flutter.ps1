# Downloads and extracts the Flutter SDK (run in background).
$ErrorActionPreference = 'Stop'

$tools = 'C:\Users\ahmad\chatter\tools'
$zip = Join-Path $tools 'flutter_windows_3.47.0-stable.zip'
$url = 'https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.47.0-stable.zip'

New-Item -ItemType Directory -Force -Path $tools | Out-Null

if (-not (Test-Path $zip)) {
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
}

if (-not (Test-Path (Join-Path $tools 'flutter\bin\flutter.bat'))) {
    # tar is ~3x faster than Expand-Archive for large zips on Windows.
    tar -xf $zip -C $tools
}

if (Test-Path (Join-Path $tools 'flutter\bin\flutter.bat')) {
    Set-Content -Path (Join-Path $tools 'FLUTTER_READY') -Value (Get-Date)
}
