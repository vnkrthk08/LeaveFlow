# Architecture notes

```text
Browser
  │ HTTP :5173 (local) / :3000 (Docker)
  ▼
React + Vite / Nginx
  │ /api/*
  ▼
Spring Boot REST API :8081 ───────────────┐
  │                                       │
  ├── Spring Data JPA ── H2 (local)       │ REST :8080 / gRPC :26500
  │                  └── PostgreSQL       ▼
  │                                Camunda 8 Self-Managed
  ├── CamundaClient ───────────────► Process engine / Operate / Tasklist
  │                                       │
  └── Job workers ◄── validate-leave / finalize-leave jobs
```

The app Compose stack contains PostgreSQL, the backend, and the Nginx frontend. Camunda's official Compose distribution is a separate local stack, started first. For containerised backend networking, `host.docker.internal` is mapped to the host gateway. On a different topology, use a shared Docker network and set the Camunda REST/gRPC addresses to the Camunda service name.

The current MVP does not include SSO, identity management, role-based access controls, notifications beyond a logging hook, public holiday calendars, or a production Camunda deployment profile.
