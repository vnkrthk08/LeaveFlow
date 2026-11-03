# LeaveFlow — Execution and Verification Record

**Execution Date:** 2026-11-03  
**Status:** Verified & Operational  
**Repository Remote:** `https://github.com/vnkrthk08/LeaveFlow`  
**Target Branch:** `main`

---

## 1. Verified Host Environment

| Component | Target Requirement | Measured / Observed on Host | Status |
|---|---|---|---|
| **Operating System** | Windows 11 | Windows 11 Enterprise (x64) | Compliant |
| **Java JDK** | Java 21+ | Java JDK 23.0.2 (`--release 21` bytecode target) | Verified |
| **Node.js** | Node 20+ / 22+ | Node.js `v24.13.0` | Verified |
| **npm** | npm 10+ | npm `11.6.2` | Verified |
| **Maven Wrapper** | Maven 3.9.x | Apache Maven 3.9.11 (via `mvnw.cmd`) | Verified |
| **Git CLI** | Git 2.x | Git `2.53.0.windows.1` | Verified |
| **Docker Desktop** | Docker Engine & Compose | Not installed on host (`docker: command not found`). Dockerfiles and Compose configurations verified structurally. | Documented |

---

## 2. Camunda 8 Self-Managed Engine

- **Distribution Version:** Camunda 8.9.27 (compatible with `camunda-spring-boot-starter:8.9.27`).
- **Runtime Mode:** Native Camunda 8 Self-Managed Run distribution (`c8run-8.9.27`).
- **REST v2 Endpoint:** `http://localhost:8080/v2/topology` — HTTP 200 Leader partition 1 healthy.
- **gRPC Gateway:** `localhost:26500` — operational.
- **Operate Web UI:** `http://localhost:8080/operate` — HTTP 200 operational.
- **Tasklist Web UI:** `http://localhost:8080/tasklist` — HTTP 200 operational.
- **Process Deployment:** Process `leave-request.bpmn` (ID: `leave-request`, Version 1) auto-deployed and active.

---

## 3. Backend Compilation and Test Suite

Executed command:
```powershell
cd backend
.\mvnw.cmd test
```

### Test Results
```text
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.example.leave.api.LeaveControllerTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.leave.api.LeaveControllerTest
[INFO] Running com.example.leave.service.LeaveServiceTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.leave.service.LeaveServiceTest
[INFO] Running com.example.leave.service.WorkingDaysCalculatorTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.leave.service.WorkingDaysCalculatorTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

- **Total Tests:** 18
- **Passed:** 18
- **Failed:** 0
- **Errors:** 0
- **Skipped:** 0

---

## 4. Frontend Type Checking and Production Build

Executed commands:
```powershell
cd frontend
npm run typecheck
npm run build
```

### Output
```text
> leave-portal@1.0.0 typecheck
> tsc --noEmit

> leave-portal@1.0.0 build
> tsc --noEmit && vite build

vite v7.1.7 building for production...
transforming...
✓ 30 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.57 kB │ gzip:  0.34 kB
dist/assets/index-BjZ962Wt.css   27.11 kB │ gzip:  6.77 kB
dist/assets/index-BCz6xYJ-.js   224.19 kB │ gzip: 68.41 kB
✓ built in 3.39s
```
- **TypeScript Diagnostics:** 0 errors
- **Vite Production Assets:** Generated cleanly in `dist/`

---

## 5. Live End-to-End Scenario Verification (Phases 7 & 9)

Executed automated E2E script `scripts/run-e2e-tests.ps1` against live services:
- **Backend:** `http://localhost:8081`
- **Frontend:** `http://localhost:5173`
- **Camunda 8:** `http://localhost:8080`

### Scenario Test Matrix

| Scenario | Description | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **TEST A** | Successful Approval (Mon-Wed 3 days) | Validated by worker, manager approves with comment, Camunda completes, balance decreases by 3 days | Process `2251799813686153` started, status `PENDING_APPROVAL`, approved by manager, status `APPROVED`, balance `20 -> 17` days | **PASSED** |
| **TEST B** | Manager Rejection (2 days) | Request validated, manager rejects with comment, Camunda completes, balance unchanged | Process `2251799813686194` started, rejected by manager, status `REJECTED`, balance remains `20` days | **PASSED** |
| **TEST C** | Insufficient Balance (25 days requested, 17 remaining) | Worker auto-rejects, manager review bypassed, no balance deduction | Process `2251799813686238` auto-rejected by worker, status `REJECTED`, absent from Manager Inbox | **PASSED** |
| **TEST D** | Weekend-only Request (Sat-Sun) | 0 working days detected by worker, auto-rejected, manager review bypassed | Process `2251799813686269` auto-rejected with message `"The selected date range contains no working days."` | **PASSED** |
| **TEST E** | Invalid Dates (End date before start date) | Rejected at submission time with HTTP 400 Bad Request | Threw HTTP 400 with message `"End date must be the same as or later than the start date."` | **PASSED** |
| **TEST F** | Data Persistence & Consistency | Requests and balances persist across queries and database transactions | Multiple persisted requests retrieved correctly from H2 database (`jdbc:h2:file:./data/leavedb`) | **PASSED** |
| **TEST G** | Camunda Operate & Zeebe Monitoring | Active and completed process instances queryable via Camunda REST API | Verified 9 process instances indexed and queryable in Camunda engine | **PASSED** |

---

## 6. Docker Deployment Readiness

- **Backend Dockerfile:** Multi-stage build (`maven:3.9.11-eclipse-temurin-21` -> `eclipse-temurin:21-jre`), dedicated non-root `appuser`, JVM memory tuning.
- **Frontend Dockerfile:** Multi-stage build (`node:22-alpine` -> `nginx:1.27-alpine`), healthcheck configured.
- **Nginx Configuration:** Reverse proxy routing `/api/` traffic to `backend:8081` with security headers and SPA fallback.
- **Database Service:** PostgreSQL 16 Alpine container with persistent volume `leave-postgres-data` and healthcheck.
- **Note:** Docker Desktop is not installed on this local workstation. Container deployment can be performed on any machine with Docker Engine using `docker compose up --build -d`.
