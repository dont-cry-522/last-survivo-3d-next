@echo off
cd /d "%~dp0"
py -3 --version >nul 2>&1
if not errorlevel 1 (
 py -3 "%~dp0start-offline.py"
 goto finished
)
python --version >nul 2>&1
if not errorlevel 1 (
 python "%~dp0start-offline.py"
 goto finished
)
node --version >nul 2>&1
if not errorlevel 1 (
 node "%~dp0start-offline.mjs"
 goto finished
)
echo Python 3 or Node.js is required. Install one before going offline.
echo See OFFLINE_README.txt. Do not open index.html directly.
:finished
pause
