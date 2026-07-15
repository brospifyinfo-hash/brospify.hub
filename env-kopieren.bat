@echo off
title Editor-Setup: Env-Keys kopieren + Deploy
cd /d "C:\Users\Win11 Pro\brospify-hub-work"
echo ==================================================
echo   Kopiert die Login-/AI-Schluessel vom Hub-Projekt
echo   ins Editor-Projekt und deployt den Editor neu.
echo   (Werte werden nie angezeigt oder gespeichert.)
echo ==================================================
echo.
node env-kopieren.mjs
echo.
pause
