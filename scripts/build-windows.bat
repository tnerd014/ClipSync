@echo off
echo ========================================================
echo    ClipSync - Building Windows Desktop Installer (.exe)
echo ========================================================
echo.

REM 1. Build frontend distribution
echo [1/3] Building frontend distribution with Vite...
call npm install
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error building web distribution!
    pause
    exit /b %ERRORLEVEL%
)

REM 2. Copy dist into electron folder
echo [2/3] Copying dist assets into electron folder...
if not exist "electron\dist" mkdir "electron\dist"
xcopy /E /Y /I dist electron\dist

REM 3. Run electron-builder to generate Setup EXE
echo [3/3] Compiling Windows Setup Installer with electron-builder...
cd electron
call npm install
call npx electron-builder --win nsis --x64
if %ERRORLEVEL% NEQ 0 (
    echo Error during electron packaging!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo SUCCESS! Your Windows Setup EXE is ready in:
echo   electron\dist-electron\ClipSync Setup 1.0.0.exe
echo ========================================================
pause
