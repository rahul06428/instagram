@echo off
SET FOLDER=%1

IF "%FOLDER%"=="" (
    echo Error: Please provide a folder path as an argument.
    echo Usage: run_classification.bat ^<folder_path^>
    exit /b 1
)

IF NOT EXIST venv (
    echo Creating virtual environment using Python 3.13...
    py -3.13 -m venv venv
    IF %ERRORLEVEL% NEQ 0 (
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

echo Running classification on: %FOLDER%
venv\Scripts\python.exe scripts/classify_faces.py %FOLDER%

IF %ERRORLEVEL% NEQ 0 (
    echo Classification script failed.
    exit /b 1
)

echo Done.
pause
