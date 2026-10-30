@echo off
title Launch Barangay DRRM System (Backend + Frontend)
echo ========================================================
echo Starting Laravel Backend (PostgreSQL) + React Frontend...
echo ========================================================

start "Barangay DRRM - Laravel Backend" cmd /k "cd /d "%~dp0..\backend" && php artisan serve --port=8000"
timeout /t 2 /nobreak >nul
start "Barangay DRRM - React Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo All services launched!
echo - Laravel Backend API: http://127.0.0.1:8000
echo - React Frontend UI:   http://localhost:3000
echo - PostgreSQL:          127.0.0.1:5432 (database: barangay_drrm)
echo.
