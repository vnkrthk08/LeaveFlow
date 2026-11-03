# REST API contract

Base URL: `http://localhost:8081`

The React application calls these endpoints through the `/api` prefix. JSON is used for request and response bodies except for the `204 No Content` manager decision response.

## Health

`GET /api/health`

Response:

```json
{
  "status": "UP",
  "service": "leave-backend"
}
```

## Submit a leave request

`POST /api/leaves`

Request:

```json
{
  "employeeName": "Alex Morgan",
  "employeeEmail": "alex@example.com",
  "leaveType": "ANNUAL",
  "startDate": "2026-11-09",
  "endDate": "2026-11-11",
  "reason": "Personal leave"
}
```

`leaveType` must be `ANNUAL`, `SICK`, or `UNPAID`. Dates use ISO `YYYY-MM-DD`. The end date must not precede the start date. A weekend-only range is submitted to Camunda and rejected by the workflow validation task because it contains no working days.

Success: `201 Created`, returning the created leave request. Validation failure: `400 Bad Request`. If the Camunda engine is not reachable or the process cannot start, the API returns `503 Service Unavailable` and stores an explanatory failed/rejected request record.

## List one employee's requests

`GET /api/leaves?employeeEmail=alex%40example.com`

Returns an array ordered by most recent first. `employeeEmail` is required and must be a valid email address.

## List manager-pending requests

`GET /api/leaves/pending`

Returns an array of requests with status `PENDING_APPROVAL`, ordered oldest first.

## Get annual leave balance

`GET /api/leaves/balance?employeeEmail=alex%40example.com`

Response:

```json
{
  "remainingDays": 20
}
```

The first balance lookup initialises the example entitlement to 20 days, as in the uploaded guide.

## Approve or reject a request

`POST /api/leaves/{id}/decision`

Approve:

```json
{
  "approved": true,
  "comment": "Approved. Enjoy your time off."
}
```

Reject:

```json
{
  "approved": false,
  "comment": "Please coordinate coverage before resubmitting."
}
```

Success: `204 No Content`. `409 Conflict` means the request is not pending or the Camunda manager user task is not yet indexed. `404 Not Found` means the leave request ID does not exist. `503 Service Unavailable` means the backend could not reach Camunda to complete the task.

## Leave request response fields

| Field | Type | Meaning |
|---|---|---|
| `id` | number | Database request ID |
| `employeeName` | string | Employee display name |
| `employeeEmail` | string | Normalised email identifier |
| `leaveType` | string | `ANNUAL`, `SICK`, or `UNPAID` |
| `startDate`, `endDate` | string | ISO date range |
| `days` | number | Weekdays in the inclusive date range |
| `reason` | string | Employee note |
| `status` | string | `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, or `REJECTED` |
| `statusMessage` | string | Validation or manager note |
| `processInstanceKey` | number/null | Camunda process instance key, when available |
| `createdAt`, `updatedAt` | string | ISO-8601 timestamps |
