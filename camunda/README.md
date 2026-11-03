# Camunda 8 local engine

Camunda's Docker Compose distribution is intentionally kept separate from the application `docker-compose.yml`. Use the **lightweight** Camunda 8.9 configuration for this learning MVP. It contains the Orchestration Cluster, Operate, Tasklist, and Connectors, and uses file-based H2 secondary storage. The app's own Docker Compose stack contains PostgreSQL, Spring Boot, and the React/Nginx frontend.

## Download the distribution

1. Open the official [Camunda 8.9 Docker Compose quickstart](https://docs.camunda.io/docs/8.9/self-managed/quickstart/developer-quickstart/docker-compose/install-start/) and [Camunda Distributions releases](https://github.com/camunda/camunda-distributions/releases).
2. Download a complete Camunda 8.9 Self-Managed Docker Compose distribution compatible with the `camunda.version` property in `backend/pom.xml` (currently `8.9.12`). The starter and cluster must use a compatible Camunda 8.9 line. If the exact distribution patch is not published for the cluster image you intend to use, select a compatible 8.9 patch and confirm the matching Java client/starter compatibility before changing the version property.
3. Extract the complete archive into `camunda/distribution/`. Keep its `.env`, `configuration/`, and Compose files together.
4. For this project, start the lightweight/default `docker-compose.yaml` configuration. **Do not use `docker-compose-full.yaml` unless you also configure OAuth in the Spring Boot Camunda client.** The full configuration protects the Orchestration Cluster API with OAuth, whereas the lightweight local configuration leaves the REST and gRPC APIs publicly accessible by default.

## Start the lightweight engine

In PowerShell:

```powershell
cd camunda/distribution
docker compose up -d
docker compose ps
```

Wait until the Orchestration Cluster reports healthy. Then check:

- Operate: http://localhost:8080/operate
- Tasklist: http://localhost:8080/tasklist
- Orchestration Cluster REST API: http://localhost:8080/v2
- gRPC: localhost:26500

The default credentials for the Camunda web interfaces are `demo` / `demo`. The lightweight configuration exposes REST and gRPC APIs without authentication by default, which matches this project's default Spring Boot client settings. Do not expose this local development distribution to a public network.

## Connect the app

- Local Spring Boot connects to REST `http://localhost:8080` and gRPC `http://localhost:26500`.
- Application Docker Compose connects to the host through `host.docker.internal` on those ports. Override `CAMUNDA_REST_ADDRESS` and `CAMUNDA_GRPC_ADDRESS` in the app `.env` file if your host/network uses different addresses.
- If you deliberately choose the full Camunda configuration, configure the appropriate OAuth client credentials in `backend/src/main/resources/application.yml` and the app's environment before starting Spring Boot. The default sample configuration in this repository is not an OAuth client for the full stack.

Stop Camunda from its own distribution folder with `docker compose down`. Add `-v` only when you intentionally want to delete Camunda's persisted local data.

> Camunda's Docker Compose distribution is for local development/evaluation, not production deployment. Do not expose its ports publicly.
