@echo off
REM Keeps the agent running forever; restarts it 10s after any crash.
cd /d "%~dp0"
set TZ=UTC
set NODE_ENV=production
if not exist logs mkdir logs
:loop
REM Start a fresh log when it passes ~20 MB
for %%F in (logs\agent.log) do if %%~zF GTR 20000000 move /y logs\agent.log logs\agent.old.log >nul
"%~dp0node\node.exe" --env-file=.env agent.js >> logs\agent.log 2>&1
REM "timeout" needs a console (fails under the SYSTEM task) - ping is the portable sleep
ping -n 11 127.0.0.1 >nul
goto loop
