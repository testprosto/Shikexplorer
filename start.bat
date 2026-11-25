@echo off
setlocal
cd /d "%~dp0"
title Shikimori Title Explorer (Portable)
cls

echo ======================================================
echo   Shikimori Explorer - Portable Edition
echo ======================================================
echo.

set "NODE_CMD="

if exist "%~dp0bin\node.exe" (
    set "NODE_CMD=%~dp0bin\node.exe"
    echo [OK] Using bundled portable Node.js (bin\node.exe)
) else (
    where node >nul 2>&1
    if not errorlevel 1 (
        set "NODE_CMD=node"
        echo [OK] Using system Node.js
    )
)

if "%NODE_CMD%"=="" (
    echo [ERROR] Node.js was not found!
    echo Please install Node.js from https://nodejs.org/ or place node.exe into the bin folder.
    echo.
    pause
    exit /b 1
)

echo Starting Shikimori Explorer server...
echo Local address: http://localhost:3000
echo.

start http://localhost:3000
"%NODE_CMD%" server.js

pause
