# This script applies migrations to your Supabase project.
# You can execute this file in PowerShell by running `.\update-db.ps1`.

Write-Host "Checking for Supabase CLI..." -ForegroundColor Cyan

if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Write-Host "Running: supabase db push" -ForegroundColor Yellow
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database schema updated successfully!" -ForegroundColor Green
    } else {
        Write-Error "❌ Failed to apply migrations. Please ensure your Supabase CLI is logged in and linked."
    }
} else {
    Write-Warning "⚠️ Supabase CLI is not installed globally or locally on your system."
    Write-Host "Option 1: Install Supabase CLI using npm:" -ForegroundColor Cyan
    Write-Host "  npm install -g supabase" -ForegroundColor White
    Write-Host "  supabase login" -ForegroundColor White
    Write-Host "  supabase link --project-ref <your-project-ref>" -ForegroundColor White
    Write-Host "  supabase db push" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Manual Update (Easiest & Recommended for Hosted DBs):" -ForegroundColor Cyan
    Write-Host "  Copy the SQL contents of the file below:" -ForegroundColor Gray
    Write-Host "  [supabase/migrations/00000000000003_allow_anon_profiles.sql]" -ForegroundColor Yellow
    Write-Host "  And execute it directly inside your Supabase Project's SQL Editor:" -ForegroundColor Gray
    Write-Host "  👉 https://supabase.com/dashboard/project/_/sql/new" -ForegroundColor Green
}
