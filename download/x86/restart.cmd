@echo off
setlocal enabledelayedexpansion

:: %1: OLD_EXE (Full path to old executable)
:: %2: PID (Old process ID to wait for)
set "OLD_EXE=%~1"
set "OLD_DIR=%~dp1"
set "EXE_NAME=%~nx1"
set "PID=%~2"
set "UPDATE_SRC=%~dp0"
set "TARGET_DIR=%LOCALAPPDATA%\NTSAA"
set "TARGET_EXE=%TARGET_DIR%\!EXE_NAME!"

echo [NTSAA] Preparing update...

:: 1. Wait for old process to exit
if not "%PID%"=="" (
    :WAIT_LOOP
    tasklist /FI "PID eq %PID%" 2>nul | findstr "%PID%" >nul
    if %errorlevel% equ 0 (
        timeout /t 1 /nobreak >nul
        goto :WAIT_LOOP
    )
)

:: 2. Safety kill (if user manually reopened)
taskkill /F /IM "!EXE_NAME!" >nul 2>&1

:: 3. Prepare target directory
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%" 2>nul

:: 4. COPY SYSTEM FILES (Main task)
:: Exclude ZIP files, cleanup scripts, and this script itself from being copied to app folder
echo [COPY] Copying new system files...
robocopy "%UPDATE_SRC%." "%TARGET_DIR%." /E /MOVE /XF "restart.cmd" "clean.txt" "*.zip" /R:3 /W:2 >nul 2>&1

:: 5. UNBLOCK FILES (Prevent SmartScreen)
echo [SECURITY] Unblocking files...
powershell -NoProfile -WindowStyle Hidden -Command "Get-ChildItem -Path '!TARGET_DIR!' -Recurse | Unblock-File" >nul 2>&1

:: 6. RELAUNCH APP IMMEDIATELY (Priority #1)
echo [RELAUNCH] Restarting application...
timeout /t 1 /nobreak >nul

if exist "!TARGET_EXE!" (
    cd /d "%TARGET_DIR%"
    start "" "!TARGET_EXE!" restart
) else (
    echo [ERROR] Application file not found at: !TARGET_EXE!
    pause
)

:: 7. CHECK FOR MIGRATION
if /i "!OLD_DIR!" equ "!TARGET_DIR!\" exit /b 0

:: ==========================================
:: MIGRATION TASKS (Only if old path != localapp)
:: ==========================================

:: 8. FIX SHORTCUTS
echo [SHORTCUT] Updating shortcuts...
powershell -NoProfile -WindowStyle Hidden -Command ^
    "$oldExe = '!OLD_EXE!';" ^
    "$newExe = '!TARGET_EXE!';" ^
    "$newDir = '%TARGET_DIR%';" ^
    "$sh = New-Object -ComObject WScript.Shell;" ^
    "$targets = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('StartMenu'), [Environment]::GetFolderPath('CommonStartMenu'));" ^
    "foreach ($dir in $targets) { if (Test-Path $dir) {" ^
        "Get-ChildItem -Path $dir -Filter '*NTSAA*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {" ^
            "$lnk = $sh.CreateShortcut($_.FullName);" ^
            "if ($lnk.TargetPath -ieq $oldExe) {" ^
                "$lnk.TargetPath = $newExe;" ^
                "$lnk.WorkingDirectory = $newDir;" ^
                "$lnk.Save();" ^
            "}" ^
        "}" ^
    "}}"

:: 9. CLEANUP OLD LOCATION
echo [CLEANUP] Cleaning up old directory...

:: Remove legacy Backup folder at old location if exists
if exist "!OLD_DIR!Backup" rd /s /q "!OLD_DIR!Backup" >nul 2>&1

set "HAS_NTSAA_NAME=0"
echo !OLD_DIR! | findstr /i "NTSAA" >nul
if !errorlevel! equ 0 set "HAS_NTSAA_NAME=1"

set "HAS_EXE_FILE=0"
if exist "!OLD_EXE!" set "HAS_EXE_FILE=1"

if "!HAS_NTSAA_NAME!"=="1" if "!HAS_EXE_FILE!"=="1" (
    :: Folder contains NTSAA and EXE -> safe to delete whole folder
    set "OLD_DIR_CLEAN=!OLD_DIR:~0,-1!"
    cd /d "%TEMP%"
    rd /s /q "!OLD_DIR_CLEAN!" >nul 2>&1
) else (
    :: Not a dedicated app folder -> only delete the executable
    if exist "!OLD_EXE!" del /f /q "!OLD_EXE!" >nul 2>&1
)

exit /b 0
