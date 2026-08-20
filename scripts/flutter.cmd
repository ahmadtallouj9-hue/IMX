@echo off
REM Wrapper to run the local Flutter SDK from its own directory.
cd /d "%~dp0..\tools\flutter"
call bin\flutter.bat %*
