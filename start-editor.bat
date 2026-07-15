@echo off
title Brospify Editor - Dev-Server (Fenster offen lassen)
cd /d "C:\Users\Win11 Pro\brospify-hub-work"
echo ==================================================
echo   Brospify Editor - Server startet ...
echo   Dieses Fenster BITTE offen lassen, solange du
echo   den Editor benutzt.
echo.
echo   Wenn unten "Ready" steht, im Browser oeffnen:
echo     http://localhost:3000/start
echo     http://localhost:3000/editor
echo ==================================================
echo.
call npm run dev
echo.
echo Server wurde beendet. Taste druecken zum Schliessen ...
pause
