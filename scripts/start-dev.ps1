$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "LeaveFlow development launcher" -ForegroundColor Cyan
Write-Host "Checking prerequisites..."

foreach ($tool in @('java', 'node', 'npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "Required command '$tool' was not found. Install Java 21 and Node.js 22+, then reopen PowerShell."
  }
}

$javaVersion = (& java -version 2>&1 | Select-String 'version' | Select-Object -First 1).ToString()
Write-Host "Java: $javaVersion"
Write-Host "Node: $(& node -v)"

$camunda = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet
if (-not $camunda) {
  Write-Warning "Camunda REST port 8080 is not responding. Start the separate Camunda distribution first (see camunda/README.md)."
}

Start-Process powershell -ArgumentList @('-NoExit', '-Command', "Set-Location '$root\backend'; .\mvnw.cmd spring-boot:run")
Start-Process powershell -ArgumentList @('-NoExit', '-Command', "Set-Location '$root\frontend'; npm install; npm run dev")
Write-Host "Opened backend and frontend terminals. Portal: http://localhost:5173" -ForegroundColor Green
