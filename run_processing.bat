@echo off
SET FOLDER=%1

IF "%FOLDER%"=="" (
    echo Error: Please provide a folder path as an argument.
    echo Usage: run_processing.bat ^<folder_path^>
    exit /b 1
)

IF NOT EXIST venv (
    echo Creating virtual environment using Python 3.13...
    py -3.13 -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to create virtual environment. Please ensure Python 3.13 is installed.
        exit /b 1
    )
)

echo Checking/Installing dependencies...
venv\Scripts\python.exe -m pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies.
    exit /b 1
)

if not exist logs mkdir logs

echo Running processing on: %FOLDER%
venv\Scripts\python.exe comfy_batch_processor.py %FOLDER% | powershell -Command "$input | Tee-Object -FilePath 'logs\processing.log' -Append"

IF %ERRORLEVEL% NEQ 0 (
    echo processing script failed.
    exit /b 1
)

echo Done.
pause
