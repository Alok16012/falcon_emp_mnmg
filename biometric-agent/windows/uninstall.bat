@echo off
REM Stops the agent and removes auto-start.
net session >nul 2>&1 || (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
schtasks /end /tn "FalconBiometric" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
schtasks /delete /tn "FalconBiometric" /f
netsh advfirewall firewall delete rule name="Falcon Biometric 8099" >nul 2>&1
echo Agent removed.
pause
