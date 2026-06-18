# This script stages all changes, commits them, and pushes them to your current Git branch dynamically.
# Run this file in PowerShell by running `.\push-updates.ps1`.

Write-Host "Staging all changes..." -ForegroundColor Cyan
git add --all

# Get current branch name dynamically
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Current branch detected: $branch" -ForegroundColor Yellow

$commitMessage = "feat: implement landing page role selection, visitor connection booking checks, and host rescheduling email notifications"
Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing to remote origin branch '$branch'..." -ForegroundColor Cyan
git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git repository updated successfully!" -ForegroundColor Green
} else {
    Write-Warning "⚠️ Push failed. Please check if your remote origin is set up correctly or run 'git push -u origin $branch' manually."
}
