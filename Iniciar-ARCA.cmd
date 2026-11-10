@echo off
cd /d "%~dp0"
if not exist node_modules call npm.cmd ci
node server/local.js
pause
