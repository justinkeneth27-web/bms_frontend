@echo off
title Laravel Backend API (Port 8000)
cd /d "%~dp0..\backend"
echo ===================================================
echo Starting Barangay DRRM Laravel Backend
echo Running at http://127.0.0.1:8000
echo PostgreSQL Database: barangay_drrm (Port 5432)
echo ===================================================
php artisan serve --port=8000
pause
