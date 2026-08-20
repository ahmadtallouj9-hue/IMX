@echo off
REM Runs Flutter commands from the client/ directory using the local SDK.
cd /d "%~dp0..\client"
call "%~dp0..\tools\flutter\bin\flutter.bat" %*