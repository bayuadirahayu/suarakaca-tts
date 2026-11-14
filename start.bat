@echo off
title SuaraKaca - Text to Speech
echo ========================================================
echo  SuaraKaca - Text to Speech Bahasa Indonesia
echo  Tema: Spotify Liquid Glass Minimalist
echo ========================================================
echo.
echo Menjalankan server aplikasi di http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
