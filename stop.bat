@echo off
setlocal

:: ==============================================================
:: OpenClaw Gemini CLI Adapter - Stop All Processes (Windows)
:: ==============================================================

echo ==============================================================
echo  全プロセスを終了しています...
echo ==============================================================

:: 1. アダプター (ポート 3972) をキル
echo -^> ポート 3972 (Adapter) のプロセスを終了中...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3972 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul

:: 2. Gateway (ポート 18789) をキル
echo -^> ポート 18789 (Gateway) のプロセスを終了中...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :18789 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul

:: 3. Dashboard (ポート 19878) をキル
echo -^> ポート 19878 (Dashboard) のプロセスを終了中...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :19878 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul

:: 4. Runner / Gemini CLI 関連のプロセス名でキル
echo -^> node/bun プロセスのクリーンアップ...
taskkill /f /im bun.exe 2>nul
:: node.exe は Gateway 以外も巻き込む可能性があるが、安全のため /fi でフィルタリング
taskkill /f /fi "WINDOWTITLE eq OpenClaw*" 2>nul

echo.
echo ==============================================================
echo  ^Check すべてのプロセスを終了しました。
echo ==============================================================
pause
