@echo off
chcp 65001 >nul
title Eczane App Kurulum
cd /d "%~dp0"

echo.
echo   ══════════════════════════════════
echo        ECZANE APP KURULUMU
echo   ══════════════════════════════════
echo.

:: Node.js kontrolü
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js bulunamadi!
    echo   [!] Indirme sayfasi aciliyor...
    start https://nodejs.org
    echo.
    echo   Node.js kurup bu dosyayi tekrar calistirin.
    pause
    exit /b 1
)
echo   [OK] Node.js bulundu

:: npm install
echo   [..] Bagimliliklar yukleniyor...
call npm install --production --silent 2>nul
echo   [OK] Bagimliliklar yuklendi

:: data klasörü
if not exist "data" mkdir data

:: Kısayollar (masaüstü + başlangıç)
echo   [..] Kisayollar olusturuluyor...
cscript //nologo "%~dp0create-shortcut.vbs"

echo.
echo   ══════════════════════════════════
echo        KURULUM TAMAMLANDI!
echo   ══════════════════════════════════
echo.
echo   Masaustunde "Eczane App" simgesi
echo   olusturuldu. Uygulama baslatiliyor...
echo.

:: Hemen başlat
start "" wscript "%~dp0start.vbs"

timeout /t 5 /nobreak >nul
