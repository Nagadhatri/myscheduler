# -------------------------------------------------
# update‑myscheduler.ps1  –  PowerShell script for Windows
# -------------------------------------------------
# 1️⃣  Change to the project root
Set-Location "C:\Users\nagad\myscheduler"

# 2️⃣  (Optional) Set Supabase env variables for this session
#    Replace the placeholders with your real values.
$env:NEXT_PUBLIC_SUPABASE_URL   = "https://<YOUR‑PROJECT>.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<YOUR‑ANON‑PUBLIC‑KEY>"

# 3️⃣  Install npm packages (runs only if package‑json changed)
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Cyan
npm install

# 4️⃣  Start the Next.js dev server (http://localhost:3000)
Write-Host "`nStarting Next.js dev server (http://localhost:3000)..." -ForegroundColor Cyan
npm run dev

# -------------------------------------------------
# OPTIONAL: Uncomment the block below if you want to
# automatically stage/commit/push after making further edits.
# -------------------------------------------------
<#
Write-Host "`nStaging all changes..." -ForegroundColor Cyan
& 'C:\Program Files\Git\bin\git.exe' add -A

$commitMsg = "feat: password toggle, open booking for non‑acquaintances, owner approval flow"
Write-Host "`nCommitting changes..." -ForegroundColor Cyan
& 'C:\Program Files\Git\bin\git.exe' commit -m "$commitMsg"

Write-Host "`nPushing to remote (origin/main)..." -ForegroundColor Cyan
& 'C:\Program Files\Git\bin\git.exe' push origin main
#>
