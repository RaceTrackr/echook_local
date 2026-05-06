@echo off
title eChook Live
cd /d "%~dp0"

echo eChook Live
echo -----------

if not exist node_modules\.bin\concurrently.cmd (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed. Is Node.js installed?
        pause
        exit /b 1
    )
    echo.
)

echo Starting servers. The network URL will appear below -- share it with other devices.
echo Press Ctrl+C to stop.
echo.
npm start
pause
