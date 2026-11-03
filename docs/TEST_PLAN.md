# End-to-end acceptance test plan

Run with Camunda, Spring Boot, React, and the database active. Use test identities only. The sample initial annual balance is 20 days.

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| T01 | Approved annual leave | Submit three weekdays; approve in Manager Inbox. | `APPROVED`; annual balance reduced by 3 exactly once. |
| T02 | Manager rejects request | Submit a valid request; reject with a comment. | `REJECTED`; annual balance unchanged; comment appears in status message. |
| T03 | Insufficient annual balance | Request more weekdays than the remaining annual balance. | Validation worker rejects before manager approval; no balance deduction. |
| T04 | Weekend-only range | Submit Saturday through Sunday. | `days` is 0; workflow routes to rejected finalisation; request becomes `REJECTED`. |
| T05 | Invalid date order | POST a request whose end date is earlier than the start date. | `400 Bad Request`; no process is started. |
| T06 | Sick / unpaid leave | Submit valid sick or unpaid leave; manager approves. | `APPROVED`; annual balance is not deducted. |
| T07 | Process observation | Open Operate; inspect process and variables. | Process ID `leave-request`; expected route and `requestId`, `valid`, `validationMessage`, `approved`, `managerComment`, `outcome` variables. |
| T08 | Idempotent finalisation | Verify worker retries do not process a terminal request a second time. | Annual balance is not deducted twice. |
| T09 | Tasklist parity | Submit a valid request and inspect/complete its manager task in Tasklist (only for a test instance not also completed through the custom UI). | Process reaches the matching approved/rejected end event. |

## Backend unit tests

```powershell
cd backend
.\mvnw.cmd test
```

## Frontend checks

```powershell
cd frontend
npm install
npm run typecheck
npm run build
```

## Docker checks

```powershell
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Do not proceed to any public deployment until all end-to-end cases pass and authentication/authorisation has been added.
