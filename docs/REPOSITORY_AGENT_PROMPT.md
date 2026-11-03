# Prompt for a repository-aware coding agent

Copy this prompt into GitHub Copilot Chat / your repository coding agent after pushing the project. Run it from the repository root with the repository open.

---

You are the senior engineer responsible for auditing and completing this LeaveFlow repository. Read the entire repository before changing code, including README.md, all source files, BPMN and Camunda form resources, Dockerfiles, docker-compose.yml, and the test plan. Preserve the source requirements and do not silently remove features.

## Required product contract

- React + Vite + TypeScript frontend with three views: Apply for leave, My requests, and Manager inbox.
- Spring Boot Java 21 backend on port 8081.
- Camunda 8 Self-Managed workflow with BPMN process ID `leave-request`.
- BPMN job worker type names exactly `validate-leave` and `finalize-leave`.
- Camunda manager form ID `leave-approval`, with form keys `approved` and `managerComment`.
- Process variables include `requestId`, `employeeEmail`, `leaveType`, `days`, `startDate`, `endDate`, `valid`, `validationMessage`, `approved`, `managerComment`, and `outcome`.
- REST routes: `POST /api/leaves`, `GET /api/leaves?employeeEmail=...`, `GET /api/leaves/pending`, `GET /api/leaves/balance?employeeEmail=...`, and `POST /api/leaves/{id}/decision`.
- Default annual leave entitlement in the example is 20 days. Weekdays are Monday–Friday. Deduct annual balance only after approval and ensure worker retries cannot deduct twice.
- Local app ports: React 5173, Spring Boot 8081, Camunda REST/UI 8080, Camunda gRPC 26500. Docker frontend host port 3000.

## Mandatory audit and repair sequence

1. Identify the exact Spring Boot/Camunda starter compatibility for the pinned dependency and the selected Camunda distribution. Do not mix Camunda starter artifact families or minor versions. Record the exact verified pair and update Maven properties/documentation consistently.
2. Compile and test the backend using Java 21 and the included Maven wrapper. Fix all compile errors, dependency resolution problems that are in the repository's control, static-analysis failures, and test failures. Do not claim that the Camunda integration passed unless a real matching Camunda cluster was started and tested.
3. Install frontend dependencies, run TypeScript checking and production build. Fix every error and warning that indicates a broken runtime behaviour.
4. Validate `leave-request.bpmn` and `leave-approval.form` using the target Camunda Modeler / engine. Confirm that the gateway expressions, default rejection paths, form definition, task type names, I/O mappings, and job worker variables agree exactly with the backend.
5. Start the full stack and run every case in `docs/TEST_PLAN.md`: approved annual leave, manager rejection, insufficient balance, weekend-only range, invalid date order, sick/unpaid leave, Operate variables, retry/idempotency, and Tasklist inspection.
6. Check that the REST contract used by React matches controller routes, field names, response status codes, and error messages.
7. Check Docker networking: browser → Nginx → backend → PostgreSQL, and backend → host/cluster Camunda REST and gRPC. Run `docker compose config`, build images, and test the portal via port 3000.
8. Verify that `.env`, credentials, local databases, target/, node_modules/, and the downloaded Camunda distribution are ignored by Git. Never commit secrets.
9. Review the UI at desktop, tablet, and mobile widths. Preserve keyboard access, form labels, helpful empty/error/loading states, and the three required screens.
10. Do not present this MVP as production secure. Manager endpoints have no authentication/role authorisation. Document any required security work prominently.

## Completion report

At the end, provide:
- Files changed and why.
- Exact Java/Maven/Node/npm/Docker/Camunda versions used.
- Commands run and their exit codes.
- Backend test count and result.
- Frontend typecheck/build result.
- BPMN deployment and live workflow result, explicitly marked NOT RUN if no cluster was available.
- Docker build and service-health result, explicitly marked NOT RUN if Docker was unavailable.
- Remaining risks and exact next commands for the repository owner.

Never write “100% error-free” unless every relevant build, test, and live integration step actually ran successfully. Never fabricate command output, passing tests, screenshots, or deployed environments. Prefer minimal, reviewable fixes over broad rewrites. Preserve the BPMN IDs, task types, form keys, variables, and API contract unless a proven compatibility issue requires a documented change.

---
