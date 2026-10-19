# Opens Mayday on a phone-sized screen on this PC, like iPhone Mirroring on a Mac.
#
#   powershell -ExecutionPolicy Bypass -File mirror\launch.ps1          the built app (mobile\dist)
#   powershell -ExecutionPolicy Bypass -File mirror\launch.ps1 -Dev     the live dev server (npx expo start --web)
#
# The window is sized so one iPhone point is exactly one screen pixel: an
# iPhone 17 Pro screen (402 x 874 points, 1206 x 2622 pixels) shows at
# 402 x 874 pixels, close to life size on a 14-inch laptop.
param([switch]$Dev)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path -Parent $here
$port = 8742

function Test-Port($p) {
    try { return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop) } catch { return $false }
}

if (-not $Dev -and -not (Test-Path (Join-Path $root 'mobile\dist\index.html'))) {
    Write-Host 'Building the web version of the app (first run only, about a minute)...'
    Push-Location (Join-Path $root 'mobile')
    $env:EXPO_PUBLIC_PROXY_URL = 'http://127.0.0.1:8787'
    $env:EXPO_PUBLIC_TTS_URL = 'http://127.0.0.1:8743'
    npx expo export -p web
    Pop-Location
}

# The adaptive voice on this PC: the neural voice server (same voice as the
# recorded clips) and the model proxy. With no API keys the proxy uses a local
# model through Ollama if one is installed; otherwise the app adapts its
# wording on its own, offline. None of this is needed for the app to work.
if (-not (Test-Port 8743)) {
    Start-Process -WindowStyle Hidden -FilePath 'python' -ArgumentList "`"$root\tools\tts_server.py`""
}
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Port 11434) -and (Test-Path $ollama)) {
    Start-Process -WindowStyle Hidden -FilePath $ollama -ArgumentList 'serve'
}
if (-not (Test-Port 8787)) {
    Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList "`"$root\proxy\src\dev.ts`"" -WorkingDirectory (Join-Path $root 'proxy')
}

if (-not (Test-Port $port)) {
    Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList "`"$here\serve.mjs`"", '--port', $port
    for ($i = 0; $i -lt 50 -and -not (Test-Port $port); $i++) { Start-Sleep -Milliseconds 100 }
}

$url = "http://localhost:$port/__mirror/"
if ($Dev) { $url += '?src=http://localhost:8081/' }

$browsers = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Start-Process $url; exit }

# A separate profile makes it its own app window (and remembers the microphone permission).
$profileDir = Join-Path $env:LOCALAPPDATA 'MaydayPhone\profile'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

Start-Process -FilePath $browser -ArgumentList @(
    "--app=$url",
    '--window-size=540,1060',
    '--window-position=40,20',
    '--force-device-scale-factor=1',
    "--user-data-dir=`"$profileDir`"",
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required'
)
