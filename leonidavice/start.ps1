# LeonidaVice — Local Server Launcher
# Run this from PowerShell: .\start.ps1

Write-Host ""
Write-Host " ◈ LeonidaVice Local Server" -ForegroundColor Magenta
Write-Host " ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host " URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host " Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host " ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Change to the script's directory
Set-Location $PSScriptRoot

# Open browser after 1 second
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:3000"
} | Out-Null

# Start server
python -m http.server 3000
