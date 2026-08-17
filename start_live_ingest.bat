@echo off
title Aegis AI - Ethereum Mainnet Live Ingestion Worker
echo Starting Continuous Ethereum Mainnet Ingestion Daemon...
cd backend
python tools/live_ingest_etherscan.py
pause
