@echo off
title Aegis AI - FastAPI Intelligence Gateway (Port 8000)
echo Starting Aegis Backend Gateway...
cd backend
python -m uvicorn WebApp.app:app --host 127.0.0.1 --port 8000 --reload
pause
