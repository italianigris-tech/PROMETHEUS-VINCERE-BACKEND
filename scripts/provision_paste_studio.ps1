# Prometheus Paste Section & Studio Provisioning Script
# Ensures the preview and screenshot dropzone server is alive, tested, and opened.

param (
    [int]$Port = 8080,
    [switch]$NoBrowser = $false,
    [switch]$Foreground = $false
)

$ErrorActionPreference = "Continue"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StudioDir = Join-Path $RepoRoot "docs\mini_run_studio"
$ServerScript = Join-Path $StudioDir "serve_preview.ts"
$StandaloneHtml = Join-Path $RepoRoot "paste.html"
$TargetUrl = "http://localhost:$Port/paste"
$HealthUrl = "http://127.0.0.1:$Port/health"

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "PROMETHEUS PASTE SECTION & DROPZONE PROVISIONER" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "Repo Root:     $RepoRoot"
Write-Host "Target URL:    $TargetUrl"
Write-Host "Health Probe:  $HealthUrl"
Write-Host ""

function Test-PortOpen([string]$HostName, [int]$PortNum) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect($HostName, $PortNum)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Test-ServerHealthy([string]$Url) {
    try {
        $res = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        return ($res.StatusCode -eq 200)
    } catch {
        return $false
    }
}

# 1. Check if server is already running
if (Test-ServerHealthy -Url $HealthUrl) {
    Write-Host "[OK] Prometheus Studio Server is already active and healthy on port $Port!" -ForegroundColor Green
} else {
    Write-Host "[*] Port $Port is not responding to health probe. Provisioning server process..." -ForegroundColor Yellow

    if ($Foreground) {
        Write-Host "[*] Starting server in foreground..." -ForegroundColor Cyan
        npx tsx $ServerScript
        return
    }

    # Launch server as a separate detached process
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx tsx `"$ServerScript`"" -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
    Write-Host "[*] Spawned server process (PID: $($proc.Id)). Waiting for initialization..." -ForegroundColor Cyan

    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 400
        if (Test-ServerHealthy -Url $HealthUrl) {
            $healthy = $true
            break
        }
    }

    if ($healthy) {
        Write-Host "[OK] Server successfully booted and verified healthy!" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Health probe timed out after 12s. Falling back to local standalone HTML mode." -ForegroundColor Yellow
    }
}

# 2. Open browser if requested
if (-not $NoBrowser) {
    if (Test-ServerHealthy -Url $HealthUrl) {
        Write-Host "[*] Opening $TargetUrl in default browser..." -ForegroundColor Cyan
        Start-Process $TargetUrl
    } else {
        Write-Host "[*] Opening local standalone file $StandaloneHtml in browser..." -ForegroundColor Cyan
        Start-Process $StandaloneHtml
    }
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "PASTE SECTION PROVISIONED & READY" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
