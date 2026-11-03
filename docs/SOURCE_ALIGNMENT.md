# Source-guide alignment and implementation decisions

This repository was assembled from the following uploaded materials:

- `Leave_Application_System_Step_1_BPMN_Guide.docx`
- `Leave_Application_System_Step_2_React_Frontend_Guide.docx`
- `Leave_Application_System_Step_3_Spring_Boot_Backend_Guide.docx`
- `Leave_Application_System_Step_4_Integration_Testing_Guide.docx`
- `Springboot Dependency.docx`
- `Leave System Architecture and Docker Deployment.png`

## Preserved contracts

| Source requirement | Repository implementation |
|---|---|
| BPMN process ID `leave-request` | `backend/src/main/resources/bpmn/leave-request.bpmn` |
| `validate-leave` and `finalize-leave` worker task types | `backend/.../worker/LeaveWorkers.java` and BPMN extension definitions |
| Form ID `leave-approval` | `backend/src/main/resources/bpmn/leave-approval.form` and BPMN user-task form definition |
| Camunda-managed user task (not a legacy job-worker user task) | BPMN includes `<zeebe:userTask />`, so Camunda's user-task search/completion APIs used by Spring Boot apply |
| Form keys `approved`, `managerComment` | Form JSON and manager decision variable map |
| Process variables `requestId`, `employeeEmail`, `leaveType`, `days`, `startDate`, `endDate`, `valid`, `validationMessage`, `approved`, `managerComment`, `outcome` | `LeaveService`, `LeaveWorkers`, and BPMN gateways/input mappings |
| React views Apply, My Requests, Manager Inbox | Frontend navigation and view components in `frontend/src/App.tsx` |
| API contract: POST, employee GET, pending GET, balance GET, decision POST | `LeaveController` and `frontend/src/api.ts` |
| Java 21, Spring Boot 3.5, backend port 8081 | Maven POM and `application.yml` |
| H2 for local development; PostgreSQL durable database | `application.yml` defaults to H2; `docker-compose.yml` uses PostgreSQL |
| Frontend dev port 5173; deployed port 3000 | Vite config and Docker Compose/Nginx |
| Example annual leave balance 20 days | `LeaveService.DEFAULT_ANNUAL_ENTITLEMENT` |
| Reject manager decisions without deducting annual balance | `finalizeRequest` only deducts for approved annual requests |
| Avoid duplicate deductions on worker retries | Pessimistic request lock and `balanceDeducted` guard |
| Camunda distribution separate from app Compose | Separate `camunda/README.md`, matching the Step 1 note and integration guide |

## Source mismatch resolved

The Step 3 backend guide uses `camunda-spring-boot-starter` with `8.8.9` as an example. The separately uploaded Spring Boot Dependencies guide specifies the `camunda-spring-boot-3-starter` artifact at `8.9.12`. Those are not interchangeable dependency declarations. This repository follows the dependency sheet: `camunda-spring-boot-3-starter` `8.9.12`, with Spring Boot 3.5.x. Confirm the exact Camunda distribution patch matches before running the cluster.

## Clarifications and limitations

- The screenshot labels the database `H2 / PostgreSQL`. This repository uses H2 locally and PostgreSQL in the app Docker Compose stack.
- The screenshot shows Camunda in a separate container group; the written guide explicitly says Camunda's local Docker Compose development distribution is separate from the application Compose stack. This repository preserves that boundary instead of shipping an invented one-file Camunda Compose stack.
- Weekday calculation excludes Saturday/Sunday. Public holidays were not specified by the uploaded guides and are not modelled.
- The guide calls for notification hooks. This repository adds a logging notification extension point but does not pretend to send email.
- Authentication and role-based access are explicitly absent from the learning MVP and are called out in the UI and README.

## Camunda 8.9 compatibility note

The selected `camunda-spring-boot-3-starter` artifact is the Spring Boot 3.5 module in the Camunda 8.9 line. Camunda's 8.9 documentation notes that Micrometer-based metrics require Micrometer 1.16 or newer with this module; the Maven build therefore imports the Micrometer 1.16.6 BOM to avoid resolving an older Spring Boot-managed Micrometer line when metrics are enabled. Spring Boot 3.5 open-source support ended in June 2026; this is acceptable for matching the supplied learning guide, but plan a supported platform upgrade or commercial support before production use.
