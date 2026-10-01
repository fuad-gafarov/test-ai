# Todo app

React frontend (`frontend/`) + Java 25 / Spring Boot backend (`backend/`). Todos are
stored in a plain text file (`todos.txt`, one per line).

## Run with Docker (recommended)

Requires Docker Desktop. From the repo folder:

```bat
docker compose up --build -d
```

Open http://localhost:8081. The first build downloads JDK 25, Gradle, and npm packages,
so it takes a few minutes.

| Command | What it does |
|---|---|
| `docker compose logs -f` | follow logs |
| `docker compose down` | stop (todos are kept in the `todo-data` volume) |
| `docker compose down -v` | stop and delete all todos |
| `docker compose up --build -d` | rebuild after code changes |

The API is also reachable directly at http://localhost:8080/api/todos.

## Run without Docker (Windows)

Requires JDK 21+ and Node.js 20+. `run.bat` starts both and opens http://localhost:5173.
Todos go to `backend\data\todos.txt`. `run.bat test` builds and tests everything.

## Deploy to AWS Fargate

See [infra/README.md](infra/README.md) and `deploy-aws.bat` / `destroy-aws.bat`.
