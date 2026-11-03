$ErrorActionPreference = 'Continue'
Write-Host "LeaveFlow environment check" -ForegroundColor Cyan
Write-Host "Note: PostgreSQL port 5432 is internal to the Docker Compose network by default." -ForegroundColor DarkGray
foreach ($tool in @('java', 'node', 'npm', 'docker')) {
  $found = Get-Command $tool -ErrorAction SilentlyContinue
  if ($found) { Write-Host "[OK] $tool -> $(& $tool --version 2>&1 | Select-Object -First 1)" -ForegroundColor Green }
  else { Write-Host "[MISSING] $tool" -ForegroundColor Yellow }
}
foreach ($port in @(8080, 8081, 26500, 3000, 5173)) {
  $open = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
  $state = if ($open) { 'OPEN' } else { 'closed' }
  Write-Host ("Port {0}: {1}" -f $port, $state)
}
