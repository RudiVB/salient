@echo off
REM ============================================================
REM  push.bat - stage, commit, and push Salient to GitHub
REM  Usage:
REM    push.bat                       -> uses the default message
REM    push.bat "your message here"   -> uses your custom message
REM ============================================================

REM -- run from the folder this script lives in (so double-click works) --
cd /d "%~dp0"

REM -- default commit message; override by passing an argument --
set "MSG=Add Supabase client + multiplayer schema"
if not "%~1"=="" set "MSG=%~1"

echo.
echo === git add . ===
git add .

REM -- skip the commit if there is nothing staged (avoids an error stop) --
git diff --cached --quiet
if %errorlevel%==0 (
    echo Nothing to commit - working tree clean.
    goto :end
)

echo.
echo === git commit -m "%MSG%" ===
git commit -m "%MSG%"

echo.
echo === git push ===
git push
if %errorlevel% neq 0 (
    echo.
    echo [!] Push failed - check your remote / credentials above.
    goto :end
)

echo.
echo === Done. Pushed to GitHub. ===

:end
echo.
pause
