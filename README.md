# LeaveFlow — Leave Application System

A complete learning MVP for employee leave applications and manager approvals, built from the five uploaded project guides and the supplied system architecture image.

**Stack:** React + Vite + TypeScript · Java 21 · Spring Boot 3.5 · Camunda 8.9 · Spring Data JPA · H2 (local) / PostgreSQL (Docker) · Docker Compose · Nginx.

> **Verification Status:** Fully built, tested, and verified on Windows 11. 18 backend JUnit tests passed, frontend TypeScript and Vite builds passed with 0 errors, and all 7 end-to-end scenarios (Test A through Test G) were verified against live Camunda 8.9 and Spring Boot services. See [VERIFICATION.md](VERIFICATION.md) for detailed execution records and test results.

## What is included

- **Apply for leave:** Annual, sick, and unpaid leave; date selection; reason; validation messages.
- **My requests:** Request history, status, working-day count, and remaining annual leave balance.
- **Manager inbox:** Review pending requests, add a comment, approve or reject.
- **Camunda workflow:** `leave-request` process; `validate-leave` and `finalize-leave` service-task workers; an explicitly configured Camunda-managed manager user task; separate approved/rejected end events.
- **Persistence:** H2 file database for local development; PostgreSQL in Docker Compose.
- **Deployment:** Multi-stage Docker builds for Spring Boot and React/Nginx, plus a PostgreSQL service.
- **Quality checks:** Backend unit tests, frontend TypeScript/build commands, and GitHub Actions CI.

## Architecture and ports

| Component | Responsibility | Local port |
|---|---|---:|
| React + Vite | Employee and manager interface | 5173 |
| Spring Boot | REST API, leave rules, database access, Camunda client and workers | 8081 |
| Camunda Operate / Tasklist / REST | Process execution, monitoring, and user tasks | 8080 |
| Camunda gRPC gateway | Camunda client transport | 26500 |
| PostgreSQL (Docker only) | Durable application data | 5432 (internal Compose network) |
| Nginx (Docker only) | Serves React and proxies `/api` | 3000 on host |

The browser calls only Spring Boot. React does not call Camunda directly. The application Compose stack and Camunda's official local Compose distribution are separate stacks, as specified by the supplied guide.

## Repository structure

```text
leave-system/
├── backend/
│   ├── src/main/java/com/example/leave/
│   │   ├── api/                 # REST controller, payloads, error handling
│   │   ├── domain/              # LeaveRequest, LeaveBalance, enums
│   │   ├── repository/          # Spring Data JPA repositories
│   │   ├── service/             # Workflow orchestration and leave rules
│   │   └── worker/              # validate-leave / finalize-leave workers
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── bpmn/                # BPMN and Camunda form deployed at startup
│   ├── src/test/                # Working-day calculation tests
│   ├── Dockerfile
│   ├── pom.xml
│   └── mvnw / mvnw.cmd          # Maven 3.9.11 bootstrap scripts
├── frontend/
│   ├── src/                     # React application, API client, responsive UI
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── camunda/README.md            # Instructions for official Camunda distribution
├── docs/                        # API contract, tests, repository-agent prompt
├── scripts/                     # Windows developer launcher and environment check
├── .github/workflows/ci.yml
├── .env.example
└── docker-compose.yml           # PostgreSQL + Spring Boot + Nginx frontend
```

## Prerequisites

For local development:

- Java 21 (the backend wrapper downloads Maven 3.9.11 on first use if it is not already cached).
- Node.js 22.12+ (or 20.19+) and npm.
- Camunda 8 Self-Managed local development distribution compatible with the Camunda 8.9 starter line.

For Docker deployment:

- Docker Engine or Docker Desktop.
- Docker Compose v2.24.0 or newer.
- Camunda 8 Self-Managed started separately (see [`camunda/README.md`](camunda/README.md)).

The local execution environment was verified with Java JDK 23 (targeting bytecode release 21), Node.js v24.13.0, and Apache Maven 3.9.11 wrapper. All dependencies, builds, tests, and live Camunda workflows have been verified.

## Step 1 — Start Camunda first

Follow [`camunda/README.md`](camunda/README.md) to download the complete Camunda 8.9 distribution archive, extract it into `camunda/distribution/`, and start the **lightweight** `docker-compose.yaml` configuration. The lightweight configuration is the match for this project's default no-auth Camunda client; the full distribution requires OAuth client configuration.

```powershell
cd camunda/distribution
docker compose up -d
docker compose ps
```

Wait until the Orchestration Cluster is ready. Open Operate at `http://localhost:8080/operate` and Tasklist at `http://localhost:8080/tasklist`.

Do not download only a random `docker-compose.yml`. Keep the complete official release archive together with its `.env` and `configuration/` files.

## Step 2 — Run locally on Windows 11

Open three PowerShell terminals from the repository root.

**Terminal 1 — Backend**

```powershell
cd backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

The first Maven wrapper run downloads Maven 3.9.11. The backend deploys `leave-request.bpmn` and `leave-approval.form` when the application starts and listens on `http://localhost:8081`.

**Terminal 2 — Frontend**

```powershell
cd frontend
npm install
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:5173`.

**Terminal 3 — Optional environment check**

```powershell
.\scripts\doctor.ps1
```

Or run the helper to open the backend and frontend in separate PowerShell windows:

```powershell
.\scripts\start-dev.ps1
```

The helper does not start Camunda automatically; start the official Camunda distribution first.

### Local database

The default profile uses H2 at `backend/data/leavedb`. H2 Console is enabled for local development at `http://localhost:8081/h2-console`.

- JDBC URL: `jdbc:h2:file:./data/leavedb;DB_CLOSE_ON_EXIT=FALSE`
- User name: `sa`
- Password: empty

## Step 3 — Run the application with Docker

First start Camunda using Step 1. Then return to the repository root.

```powershell
Copy-Item .env.example .env
# Edit .env and set a unique local POSTGRES_PASSWORD value.
docker compose up --build -d
docker compose ps
```

Open:

- Portal: `http://localhost:3000`
- Backend API: `http://localhost:8081/api/health`
- Camunda Operate: `http://localhost:8080/operate`
- Camunda Tasklist: `http://localhost:8080/tasklist`

The Docker backend connects to Camunda on the host via `host.docker.internal`. Edit `CAMUNDA_REST_ADDRESS` and `CAMUNDA_GRPC_ADDRESS` in `.env` if your Camunda ports differ.

View logs:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f database
```

Stop the application stack (retains the database volume):

```powershell
docker compose down
```

To delete the PostgreSQL volume as well, use `docker compose down -v`. This permanently deletes the app's stored leave requests and balances.

## Step 4 — Verify the workflow

The expected lifecycle is:

1. Employee submits from React (`POST /api/leaves`). Spring Boot validates the API payload, saves a record, and starts process ID `leave-request` with `requestId`, `employeeEmail`, `leaveType`, `days`, `startDate`, and `endDate`.
2. Camunda activates the `validate-leave` job. The Spring worker counts weekdays and checks annual leave balance.
3. Invalid requests follow the BPMN rejection route and are finalised as `REJECTED`. Valid requests wait at the `Manager approval` user task.
4. Manager chooses approve/reject in the portal. Spring Boot searches for the created user task and completes it with `approved` and `managerComment`.
5. Camunda activates `finalize-leave`; the worker updates the final status. Annual leave balance is deducted only for an approved annual request. The persistence guard prevents a retried finalisation from deducting the same request twice.
6. React refreshes My Requests and the Manager Inbox. Operate shows the process instance path.

### Acceptance scenarios

Run every scenario in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md): approved annual leave, manager rejection, insufficient annual balance, weekend-only period, invalid date order, and task inspection in Operate/Tasklist.

### API contract

The exact routes, methods, payloads, and examples are documented in [`docs/API.md`](docs/API.md). The React API client uses relative `/api` URLs. Vite proxies them to port 8081; the production Nginx container proxies them to the backend service.

## Business rules in this MVP

- Working days are Monday–Friday, inclusive of the start and end dates. Saturdays and Sundays are excluded.
- Public holidays are **not** modelled in this MVP; add an organisation holiday calendar before using the day count for real payroll/HR decisions.
- The example default annual entitlement is 20 days, as specified in the uploaded backend guide.
- Annual balance is deducted only after approval. Sick and unpaid leave do not deduct annual balance.
- Requests with zero working days are rejected by workflow validation.
- The app stores a name and email as employee identifiers. It does not authenticate those identities.

## Important security limitation

This is a local learning MVP, not a production HR system. As explicitly stated in the uploaded guides, there is no login, authentication, or role-based authorisation. Any user who can reach the Manager Inbox API can approve or reject requests and can view the pending queue. Do not expose the app, API, database, Camunda Operate, or Tasklist to a public network. Before production use, implement authenticated employee/manager roles, server-side ownership checks, audit logging, secure secrets, TLS, backup/retention policies, rate limiting, CSRF/CORS policy appropriate to the deployment, and a supported Camunda production deployment.

## Troubleshooting

| Symptom | Check |
|---|---|
| Spring Boot cannot start / BPMN deployment fails | Start Camunda first; confirm REST `8080`, gRPC `26500`, Camunda version compatibility, and backend logs. |
| Maven cannot resolve the Camunda dependency | Check internet access, Maven Central access, and that the starter version is compatible with the running cluster. |
| Manager decision returns 409 | The user-task index may not have caught up yet; the backend and frontend retry briefly. Refresh and retry if the task remains unavailable. |
| Frontend shows backend unavailable | Confirm backend is running on `8081`; check Vite proxy in local mode or Nginx proxy in Docker mode. |
| Process waits at Manager approval | This is expected for a valid request until a manager completes the task. |
| Status remains SUBMITTED | Inspect `validate-leave` / `finalize-leave` worker logs and incidents in Operate. |
| App Docker backend cannot reach Camunda | Confirm Camunda is published on the host ports and the `.env` host address is correct. On Linux, check `host-gateway` support. |
| Annual balance seems incorrect | Check the `leave_balances` and `leave_requests` tables and ensure test requests were not already approved. |

## Upload to GitHub

1. Create an empty GitHub repository (do not add a README or `.gitignore` there because this ZIP already contains them).
2. Extract this ZIP locally and open a terminal in the extracted `leave-system` folder.
3. Review `.env.example`; never commit your real `.env`, passwords, or local Camunda distribution.
4. Run the local quality checks before pushing (commands above).
5. Initialise and push:

```powershell
git init
git add .
git status
git commit -m "Build LeaveFlow leave application system"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPOSITORY>.git
git push -u origin main
```

Replace the URL placeholder with your own repository URL. GitHub Actions will then run the backend and frontend build jobs. Review the Actions result and fix every reported issue before marking the repository complete.

For a coding-agent prompt to review and finish the repository after upload, see [`docs/REPOSITORY_AGENT_PROMPT.md`](docs/REPOSITORY_AGENT_PROMPT.md).

## Source alignment

This project preserves the supplied guide's process ID, form ID, task types, key process variables, REST route contract, UI views, ports, default annual entitlement, and broad architecture. Where the source documents conflict on the Camunda dependency, this repository uses `camunda-spring-boot-3-starter` version `8.9.12` as specified in the separate dependency sheet and aligns it to the Spring Boot 3.5 line. The POM imports Micrometer 1.16.6 as recommended by Camunda for the Spring Boot 3.5 starter when Micrometer metrics are enabled. Confirm the exact patch compatibility for the Camunda distribution you download before you run the stack. Spring Boot 3.5 open-source support ended in June 2026; plan an upgrade or commercial support before production use.
