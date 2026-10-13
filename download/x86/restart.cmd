@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: NTSAA update / relaunch script
::   %1: OLD_EXE - full path of the running (old) executable
::   %2: PID     - its process id (waited for before copying)
:: Runs hidden: never "pause". Every step is written to %LOCALAPPDATA%\NTSAA\update.log;
:: the relaunched app moves those lines into its own log and deletes the file.
:: ============================================================================
set "OLD_EXE=%~1"
set "OLD_DIR=%~dp1"
set "EXE_NAME=%~nx1"
set "PID=%~2"
set "UPDATE_SRC=%~dp0"
set "TARGET_DIR=%LOCALAPPDATA%\NTSAA"
set "TARGET_EXE=%TARGET_DIR%\!EXE_NAME!"
set "LOG=%TARGET_DIR%\update.log"
set /a WAITED=0

if not exist "!TARGET_DIR!" mkdir "!TARGET_DIR!" 2>nul
call :log "Update started. Old exe: !OLD_EXE! (PID !PID!). Source: !UPDATE_SRC!"

:: ----------------------------------------------------------------------------
:: 1. Wait for the old process to exit (max 30 s, then force it)
:: ----------------------------------------------------------------------------
if "!PID!"=="" goto :WAIT_DONE
:WAIT_LOOP
tasklist /FI "PID eq !PID!" /NH 2>nul | findstr /R /C:"\<!PID!\>" >nul
if errorlevel 1 goto :WAIT_DONE
if !WAITED! geq 30 (
    call :log "Old process still running after 30 s: killing PID !PID!"
    taskkill /F /PID !PID! >nul 2>&1
    timeout /t 1 /nobreak >nul
    goto :WAIT_DONE
)
timeout /t 1 /nobreak >nul
set /a WAITED+=1
goto :WAIT_LOOP
:WAIT_DONE
call :log "Old process gone (waited !WAITED! s)"

:: 2. Another copy reopened by hand (this user only) would lock the files
taskkill /F /IM "!EXE_NAME!" /FI "USERNAME eq %USERNAME%" >nul 2>&1

:: ----------------------------------------------------------------------------
:: 3. Copy the new files (the script, the clean list and partial downloads stay)
:: ----------------------------------------------------------------------------
call :log "Copying new files to !TARGET_DIR!"
robocopy "!UPDATE_SRC!." "!TARGET_DIR!." /E /MOVE /XF "restart.cmd" "clean.txt" "*.zip" "*.part" /R:5 /W:2 /NP /NDL /NJH /NJS >> "!LOG!" 2>&1
set "RC=!errorlevel!"
if !RC! geq 8 (
    call :log "ERROR: copy failed (robocopy code !RC!)"
) else (
    call :log "Copy done (robocopy code !RC!)"
)

:: 4. Unblock the files (SmartScreen)
powershell -NoProfile -WindowStyle Hidden -Command "Get-ChildItem -Path '!TARGET_DIR!' -Recurse -File | Unblock-File" >nul 2>&1

:: ----------------------------------------------------------------------------
:: 5. Relaunch (first priority)
:: ----------------------------------------------------------------------------
timeout /t 1 /nobreak >nul
if not exist "!TARGET_EXE!" (
    call :log "ERROR: application not found: !TARGET_EXE!"
    exit /b 1
)
call :log "Starting !TARGET_EXE!"
cd /d "!TARGET_DIR!"
start "" "!TARGET_EXE!" restart

:: 6. Same folder: done. Another folder: migration to %LOCALAPPDATA%\NTSAA below.
if /i "!OLD_DIR!" equ "!TARGET_DIR!\" (
    call :log "Done"
    exit /b 0
)

:: ----------------------------------------------------------------------------
:: 7. Migration: shortcuts to the new exe
:: ----------------------------------------------------------------------------
call :log "Migration from !OLD_DIR!: updating shortcuts"
powershell -NoProfile -WindowStyle Hidden -Command ^
    "$oldExe = '!OLD_EXE!';" ^
    "$newExe = '!TARGET_EXE!';" ^
    "$newDir = '!TARGET_DIR!';" ^
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
    "}}" >nul 2>&1

:: ----------------------------------------------------------------------------
:: 8. Migration: clean the old location
:: ----------------------------------------------------------------------------
if exist "!OLD_DIR!Backup" rd /s /q "!OLD_DIR!Backup" >nul 2>&1

set "HAS_NTSAA_NAME=0"
echo !OLD_DIR! | findstr /i "NTSAA" >nul
if not errorlevel 1 set "HAS_NTSAA_NAME=1"

set "HAS_EXE_FILE=0"
if exist "!OLD_EXE!" set "HAS_EXE_FILE=1"

if "!HAS_NTSAA_NAME!!HAS_EXE_FILE!"=="11" (
    rem Dedicated app folder (named NTSAA, has the exe): remove it whole
    set "OLD_DIR_CLEAN=!OLD_DIR:~0,-1!"
    cd /d "%TEMP%"
    rd /s /q "!OLD_DIR_CLEAN!" >nul 2>&1
    call :log "Old folder removed: !OLD_DIR_CLEAN!"
) else (
    rem Not a dedicated folder: only the old executable
    if exist "!OLD_EXE!" del /f /q "!OLD_EXE!" >nul 2>&1
    call :log "Old executable removed: !OLD_EXE!"
)

call :log "Done (migration)"
exit /b 0

:: ----------------------------------------------------------------------------
:log
>> "!LOG!" echo [%date% %time%] %~1
exit /b 0
