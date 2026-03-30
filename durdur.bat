@echo off
chcp 65001 >nul
echo  Eczane App durduruluyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  [OK] Durduruldu.
timeout /t 2 >nul
