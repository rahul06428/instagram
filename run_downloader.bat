@echo off
set USERNAME=%1

if "%USERNAME%"=="" (
    echo Error: No username provided.
    echo Usage: run_downloader.bat [username] [--debug]
    pause
    exit /b 1
)

set INSTAGRAM_URL=https://www.instagram.com/%USERNAME%

echo Starting downloader for: %USERNAME%
echo Target URL: %INSTAGRAM_URL%

:: Check if the second argument is --debug
if "%~2"=="--debug" (
    echo [DEBUG MODE ENABLED]
    node src/downloader.ts %INSTAGRAM_URL% --debug
) else (
    node src/downloader.ts %INSTAGRAM_URL%
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo An error occurred during execution.
)

pause
