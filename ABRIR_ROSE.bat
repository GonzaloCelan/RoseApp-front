@echo off
title ROSE - No cerrar esta ventana
cd /d "%~dp0"
echo.
echo Iniciando ROSE...
echo Esta ventana debe permanecer abierta mientras usas el sistema.
echo.
start "" http://localhost:5173
npm.cmd run dev
pause
