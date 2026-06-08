<#
.SYNOPSIS
    Runs the Cartivo backend (Django REST Framework) and frontend (Next.js) together.

.DESCRIPTION
    Launches each service in its own terminal window so logs stay separate and
    Ctrl+C stops a service cleanly. Auto-detects a Python virtualenv in the
    backend folder (.venv or venv); falls back to the system `python`.

.EXAMPLE
    .\run-dev.ps1
#>

[CmdletBinding()]
param(
    [int]$BackendPort  = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = 'Stop'

# --- Resolve paths -----------------------------------------------------------
$Root        = $PSScriptRoot
$BackendDir  = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'

# --- Sanity checks -----------------------------------------------------------
if (-not (Test-Path (Join-Path $BackendDir 'manage.py'))) {
    Write-Warning "No 'manage.py' found in '$BackendDir'. The backend window will open but won't start until the Django project is created there."
}
if (-not (Test-Path (Join-Path $FrontendDir 'package.json'))) {
    throw "No 'package.json' found in '$FrontendDir'."
}

# --- Detect Python interpreter (prefer a virtualenv) -------------------------
$VenvCandidates = @(
    (Join-Path $BackendDir '.venv\Scripts\python.exe'),
    (Join-Path $BackendDir 'venv\Scripts\python.exe')
)
$PythonExe = $VenvCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $PythonExe) {
    $PythonExe = 'python'   # fall back to whatever is on PATH
    Write-Host "No virtualenv found in backend\.venv or backend\venv - using system 'python'." -ForegroundColor Yellow
} else {
    Write-Host "Using virtualenv interpreter: $PythonExe" -ForegroundColor Green
}

# --- Build the per-service commands ------------------------------------------
$BackendCmd  = "Set-Location '$BackendDir'; & '$PythonExe' manage.py runserver $BackendPort"
$FrontendCmd = "Set-Location '$FrontendDir'; npm run dev -- --port $FrontendPort"

Write-Host "Starting backend  -> http://localhost:$BackendPort"  -ForegroundColor Cyan
Write-Host "Starting frontend -> http://localhost:$FrontendPort" -ForegroundColor Cyan

# --- Launch each service in its own PowerShell window -------------------------
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit', '-Command', $BackendCmd  | Out-Null
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit', '-Command', $FrontendCmd | Out-Null

Write-Host "`nBoth services launched in separate windows. Close those windows (or Ctrl+C in each) to stop them." -ForegroundColor Green
