@echo off
title Aegis AI - Complete Stack Launcher
echo ===================================================
echo   Aegis AI: Ethereum Fraud Detection Platform
echo   Launching Frontend, Backend, and Live Ingestion
echo ===================================================
echo.
echo [1/3] Starting FastAPI Serving Gateway on http://127.0.0.1:8000 ...
start "Aegis Backend" cmd /k "cd backend && python -m uvicorn WebApp.app:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul

echo [2/3] Starting React Web Platform on http://localhost:3000 ...
start "Aegis Frontend" cmd /k "npm run dev -- --port 3000"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Live Ethereum Mainnet Ingestion Worker ...
start "Aegis Live Ingest" cmd /k "cd backend && python tools/live_ingest_etherscan.py"

echo.
echo All services are running!
echo Access the Web UI at: http://localhost:3000
echo Backend Health at:    http://127.0.0.1:8000/api/v1/health
echo ===================================================
