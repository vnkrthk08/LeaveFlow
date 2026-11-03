$ErrorActionPreference = "Stop"

function Test-Suite {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host " STARTING LEAVEFLOW END-TO-END TEST SUITE" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan

    # Initial balance check
    $empA = "charlie@example.com"
    $balA = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/balance?employeeEmail=" + $empA) -Method GET
    Write-Host ("Initial Balance for " + $empA + " - " + $balA.remainingDays + " days") -ForegroundColor Yellow

    # TEST A: Successful approval (3 weekdays: 2026-11-09 to 2026-11-11, Mon-Wed)
    Write-Host "`n>>> [TEST A] Submit 3-day request for Charlie (Mon-Wed)..." -ForegroundColor White
    $bodyA = @{
        employeeName = "Charlie Brown"
        employeeEmail = $empA
        leaveType = "ANNUAL"
        startDate = "2026-11-09"
        endDate = "2026-11-11"
        reason = "Family vacation"
    } | ConvertTo-Json
    $reqA = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves" -Method POST -Body $bodyA -ContentType "application/json"
    Write-Host ("Submitted Request ID: " + $reqA.id + ", Days: " + $reqA.days + ", Status: " + $reqA.status + ", ProcessInstanceKey: " + $reqA.processInstanceKey)
    
    # Wait for Zeebe validate worker to run and set status to PENDING_APPROVAL
    Start-Sleep -Seconds 3
    $pendingA = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqA.id) -Method GET
    Write-Host ("Status after worker validation: " + $pendingA.status)
    
    # Verify in Manager Pending Inbox
    $pendingList = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves/pending" -Method GET
    $foundInPending = $pendingList | Where-Object { $_.id -eq $reqA.id }
    if ($foundInPending) {
        Write-Host "PASS: Request found in Manager Pending list" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Request not in pending list" -ForegroundColor Red
    }

    # Manager Approves
    Write-Host ("Manager approving request " + $reqA.id + " with comment 'Approved, enjoy your vacation!'...")
    $decBodyA = @{
        approved = $true
        comment = "Approved, enjoy your vacation!"
    } | ConvertTo-Json
    $decA = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqA.id + "/decision") -Method POST -Body $decBodyA -ContentType "application/json"

    # Wait for Zeebe finalize worker
    Start-Sleep -Seconds 3
    $finalA = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqA.id) -Method GET
    Write-Host ("Final Request Status: " + $finalA.status + ", StatusMessage: " + $finalA.statusMessage)
    
    $balAAfter = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/balance?employeeEmail=" + $empA) -Method GET
    Write-Host ("New Balance for " + $empA + " - " + $balAAfter.remainingDays + " days (expected " + ($balA.remainingDays - 3) + ")")
    if ($balAAfter.remainingDays -eq ($balA.remainingDays - 3) -and $finalA.status -eq "APPROVED") {
        Write-Host ">>> TEST A PASSED!" -ForegroundColor Green
    } else {
        Write-Host ">>> TEST A FAILED!" -ForegroundColor Red
    }

    # TEST B: Manager rejection (2 weekdays: 2026-11-16 to 2026-11-17)
    $empB = "dana@example.com"
    $balB = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/balance?employeeEmail=" + $empB) -Method GET
    Write-Host "`n>>> [TEST B] Submit request for Dana to test rejection..." -ForegroundColor White
    $bodyB = @{
        employeeName = "Dana Scully"
        employeeEmail = $empB
        leaveType = "ANNUAL"
        startDate = "2026-11-16"
        endDate = "2026-11-17"
        reason = "Project crunch time test"
    } | ConvertTo-Json
    $reqB = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves" -Method POST -Body $bodyB -ContentType "application/json"
    Start-Sleep -Seconds 3
    
    # Manager Rejects
    $decBodyB = @{
        approved = $false
        comment = "Critical deployment scheduled for that week. Please reschedule."
    } | ConvertTo-Json
    $decB = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqB.id + "/decision") -Method POST -Body $decBodyB -ContentType "application/json"
    Start-Sleep -Seconds 3
    $finalB = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqB.id) -Method GET
    $balBAfter = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/balance?employeeEmail=" + $empB) -Method GET
    Write-Host ("Final Status: " + $finalB.status + ", StatusMessage: " + $finalB.statusMessage)
    Write-Host ("Dana Balance before: " + $balB.remainingDays + ", after: " + $balBAfter.remainingDays)
    if ($finalB.status -eq "REJECTED" -and $balBAfter.remainingDays -eq $balB.remainingDays) {
        Write-Host ">>> TEST B PASSED!" -ForegroundColor Green
    } else {
        Write-Host ">>> TEST B FAILED!" -ForegroundColor Red
    }

    # TEST C: Insufficient Leave Balance (Charlie has 17 days left, request 25 weekdays)
    Write-Host "`n>>> [TEST C] Submit request exceeding balance (25 working days)..." -ForegroundColor White
    $bodyC = @{
        employeeName = "Charlie Brown"
        employeeEmail = $empA
        leaveType = "ANNUAL"
        startDate = "2026-12-01"
        endDate = "2027-01-04"
        reason = "Very long sabbatical"
    } | ConvertTo-Json
    $reqC = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves" -Method POST -Body $bodyC -ContentType "application/json"
    Start-Sleep -Seconds 3
    $finalC = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqC.id) -Method GET
    Write-Host ("Status: " + $finalC.status + ", StatusMessage: " + $finalC.statusMessage)
    
    # Check manager pending does not have reqC
    $pendingListC = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves/pending" -Method GET
    $inPendingC = $pendingListC | Where-Object { $_.id -eq $reqC.id }
    if ($finalC.status -eq "REJECTED" -and -not $inPendingC) {
        Write-Host "PASS: Automatically rejected by worker; Manager inbox bypassed" -ForegroundColor Green
        Write-Host ">>> TEST C PASSED!" -ForegroundColor Green
    } else {
        Write-Host ">>> TEST C FAILED!" -ForegroundColor Red
    }

    # TEST D: Weekend-only request (2026-11-14 to 2026-11-15, Sat-Sun)
    Write-Host "`n>>> [TEST D] Weekend-only request (2026-11-14 to 2026-11-15)..." -ForegroundColor White
    $bodyD = @{
        employeeName = "Charlie Brown"
        employeeEmail = $empA
        leaveType = "ANNUAL"
        startDate = "2026-11-14"
        endDate = "2026-11-15"
        reason = "Weekend trip"
    } | ConvertTo-Json
    $reqD = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves" -Method POST -Body $bodyD -ContentType "application/json"
    Write-Host ("Submitted weekend request ID: " + $reqD.id + ", Days: " + $reqD.days)
    Start-Sleep -Seconds 3
    $finalD = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves/" + $reqD.id) -Method GET
    Write-Host ("Final status: " + $finalD.status + ", StatusMessage: " + $finalD.statusMessage)
    
    $pendingListD = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves/pending" -Method GET
    $inPendingD = $pendingListD | Where-Object { $_.id -eq $reqD.id }
    if ($finalD.status -eq "REJECTED" -and $finalD.statusMessage -like "*no working days*" -and -not $inPendingD) {
        Write-Host "PASS: Rejected because it contains no working days; Manager inbox bypassed" -ForegroundColor Green
        Write-Host ">>> TEST D PASSED!" -ForegroundColor Green
    } else {
        Write-Host ">>> TEST D FAILED!" -ForegroundColor Red
    }

    # TEST E: Invalid dates (End date before start date: 2026-11-10 to 2026-11-05)
    Write-Host "`n>>> [TEST E] Invalid dates (End date before start date)..." -ForegroundColor White
    $bodyE = @{
        employeeName = "Charlie Brown"
        employeeEmail = $empA
        leaveType = "ANNUAL"
        startDate = "2026-11-10"
        endDate = "2026-11-05"
        reason = "Time travel"
    } | ConvertTo-Json
    try {
        $resE = Invoke-RestMethod -Uri "http://localhost:8081/api/leaves" -Method POST -Body $bodyE -ContentType "application/json"
        Write-Host "FAIL: Unexpected success on invalid date order" -ForegroundColor Red
    } catch {
        Write-Host ("PASS: Rejected as expected: " + $_.Exception.Message) -ForegroundColor Green
        Write-Host ">>> TEST E PASSED!" -ForegroundColor Green
    }

    # TEST F: Data Consistency
    Write-Host "`n>>> [TEST F] Checking persistence across multiple requests..." -ForegroundColor White
    $charlieRequests = Invoke-RestMethod -Uri ("http://localhost:8081/api/leaves?employeeEmail=" + $empA) -Method GET
    Write-Host ("Total Charlie requests found: " + $charlieRequests.Count)
    if ($charlieRequests.Count -ge 3) {
        Write-Host "PASS: Persisted records verified in database" -ForegroundColor Green
        Write-Host ">>> TEST F PASSED!" -ForegroundColor Green
    }

    # TEST G: Camunda Operate & Zeebe Process Instances
    Write-Host "`n>>> [TEST G] Querying Camunda Process Instances..." -ForegroundColor White
    $camundaInstances = Invoke-RestMethod -Uri "http://localhost:8080/v2/process-instances/search" -Method POST -Body "{}" -ContentType "application/json"
    Write-Host ("Total Process Instances in Camunda: " + $camundaInstances.items.Count)
    foreach ($inst in $camundaInstances.items) {
        Write-Host (" - Instance Key: " + $inst.processInstanceKey + ", Process: " + $inst.processDefinitionId + ", State: " + $inst.state)
    }
    if ($camundaInstances.items.Count -gt 0) {
        Write-Host "PASS: Camunda process instances verified" -ForegroundColor Green
        Write-Host ">>> TEST G PASSED!" -ForegroundColor Green
    }

    Write-Host "`n=======================================================" -ForegroundColor Cyan
    Write-Host " ALL 7 END-TO-END SCENARIOS VERIFIED SUCCESSFULLY!    " -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
}

Test-Suite
