@echo off
rem =============================================================================
rem setup-win.bat - OpenClaw x Gemini CLI Adapter Windows Setup Bootstrap
rem
rem Node.js check -> auto-install via winget -> launch interactive-setup-win.js
rem =============================================================================
chcp 65001 >nul 2>&1
title OpenClaw Gemini CLI Setup (Windows)
setlocal

cd /d "%~dp0"

rem --- Node.js check ---
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo =================================================
    echo  Node.js not found. Installing automatically...
    echo  Node.js が見つかりません。自動インストールします...
    echo =================================================
    echo.
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    echo.
    echo  Installation done. Please RESTART this terminal and run setup-win.bat again.
    echo  インストール完了。ターミナルを再起動後、もう一度 setup-win.bat を実行してください。
    pause
    exit /b 0
)

rem --- Launch interactive setup ---
node "%~dp0interactive-setup-win.js"
pause
