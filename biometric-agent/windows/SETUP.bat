@echo off
REM Falcon Biometric Agent - one-click setup. Just double-click this file.
setlocal
set "SRC=%~dp0"
set "DEST=C:\falcon-biometric-agent"
title Falcon Biometric Setup

REM Opened straight from inside the zip? Windows then extracts only this one file.
if not exist "%SRC%agent.js" (
  echo.
  echo  [X] Pehle zip ko EXTRACT karo:
  echo      zip pe right-click ^> "Extract All" ^> phir us folder mein SETUP.bat chalao.
  echo.
  pause
  exit /b 1
)

REM Re-launch with admin rights (Windows will ask "Yes/No" - click Yes).
net session >nul 2>&1 || (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

if not exist "%SRC%.env" (
  echo  [X] .env file missing - naya zip mangwao.
  pause
  exit /b 1
)

echo [1/5] Purana agent band kar rahe hain (agar chal raha ho)...
schtasks /end /tn "FalconBiometric" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo [2/5] Files copy ho rahi hain: %DEST%
if /i not "%SRC%"=="%DEST%\" (
  robocopy "%SRC%." "%DEST%" /E /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 ( echo  [X] Copy failed & pause & exit /b 1 )
)

echo [3/5] Firewall mein port 8099 khol rahe hain...
netsh advfirewall firewall delete rule name="Falcon Biometric 8099" >nul 2>&1
netsh advfirewall firewall add rule name="Falcon Biometric 8099" dir=in action=allow protocol=TCP localport=8099 >nul

echo [4/5] PC ka sleep band kar rahe hain...
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
REM Fast Startup turns "Shut down" into a half-hibernate, after which the
REM at-startup task may not fire. Hibernate off = Fast Startup off = clean boots.
powercfg /h off

echo [5/5] Auto-start task bana rahe hain...
REM Task Scheduler stops tasks after 72h by default - ExecutionTimeLimit 0 = run forever
REM At-logon is a backup start; if the agent is already running it is ignored (IgnoreNew).
powershell -NoProfile -Command "$a=New-ScheduledTaskAction -Execute '%DEST%\run.bat'; $t=@((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn));$s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1); Register-ScheduledTask -TaskName FalconBiometric -Action $a -Trigger $t -Settings $s -User SYSTEM -RunLevel Highest -Force | Out-Null" || ( echo  [X] Task create failed & pause & exit /b 1 )
schtasks /run /tn "FalconBiometric" >nul

echo.
echo Agent start ho raha hai, check kar rahe hain...
powershell -NoProfile -Command "Start-Sleep 10; try { $r = Invoke-RestMethod http://localhost:8098/; Write-Host ''; Write-Host '  OK - Agent chal raha hai.' -ForegroundColor Green; Write-Host ('  Connected devices: ' + @($r.devices).Count) } catch { Write-Host '  [!] Agent ne jawab nahi diya. Log dekho: C:\falcon-biometric-agent\logs\agent.log' -ForegroundColor Yellow }"

echo.
echo  ------------------------------------------------------------
echo   Ab machine (http://192.168.0.107) ^> CGI Auto Registration:
echo      Server address : 192.168.0.111
echo      Port           : 8099
echo   Status page      : http://localhost:8098/
echo  ------------------------------------------------------------
echo.
pause
