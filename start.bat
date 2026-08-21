@echo off
title IMX - Starting...
echo.
echo  ================================
echo    IMX Chat - Local Development
echo  ================================
echo.

:: Start server
echo [1/2] Starting server on port 8080...
start "IMX Server" cmd /c "cd /d %~dp0server && npm run dev"

:: Wait for server to be ready
echo       Waiting for server...
timeout /t 8 /nobreak >nul

:: Start web
echo [2/2] Starting web on port 5173...
start "IMX Web" cmd /c "cd /d %~dp0web && npm run dev"

echo.
echo  Both started!
echo  Web:    http://localhost:5173
echo  Server: http://localhost:8080
echo.
echo  Close this window or press Ctrl+C to stop.
pause
