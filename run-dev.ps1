# This script starts the development server, bypassing PowerShell ExecutionPolicy restrictions.
# Run this file by right-clicking and selecting "Run with PowerShell" or typing `.\run-dev.ps1` in PowerShell.

Write-Host "Starting MyScheduler in development mode..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -Command "npm run dev"
