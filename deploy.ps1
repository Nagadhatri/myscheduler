# This script compiles the production Next.js build, and if successful, stages and pushes the changes to Git.
# Run this file in PowerShell by running: powershell -ExecutionPolicy Bypass -File .\deploy.ps1

Write-Host "1. Building the Web Application..." -ForegroundColor Cyan
cmd /c "npm run build"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Web application built successfully!" -ForegroundColor Green
    
    Write-Host "`n2. Staging all changes for Git..." -ForegroundColor Cyan
    git add --all
    
    # Get current branch dynamically
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    Write-Host "Current branch detected: $branch" -ForegroundColor Yellow
    
    $commitMsg = "feat: Offline VoiceBot with Vosk and Rasa, and Track My Bookings fixes"
    Write-Host "Committing changes..." -ForegroundColor Cyan
    git commit -m $commitMsg
    
    Write-Host "Pushing updates to origin branch '$branch'..." -ForegroundColor Cyan
    git push origin $branch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Git repository updated successfully!" -ForegroundColor Green
    } else {
        Write-Warning "`n⚠️ Git push failed. Please verify your internet connection or Git permissions."
    }
} else {
    Write-Error "`n❌ Web application build failed. Aborting Git commit and push."
}
