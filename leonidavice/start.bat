@echo off
title LeonidaVice — Local Server
echo.
echo  ◈ LeonidaVice Local Server
echo  ─────────────────────────────────────
echo  Starting on http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo  ─────────────────────────────────────
echo.

:: Change to the directory this batch file lives in
cd /d "%~dp0"

:: Open browser after a short delay (runs in background)
start "" timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"

:: Start the server
python -m http.server 3000

pause
