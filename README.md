# Todo List

A minimal CRUD todo list: an Express REST API with in-memory storage and a vanilla JavaScript frontend. No database, no build step.

## Features

- Create todos with a title and optional description
- List all todos with open/done counts
- Toggle a todo between `todo` and `done`
- Edit a todo's title and description inline
- Delete a todo (with confirmation)

## Tech stack

- **Backend:** Node.js 20+, Express 4
- **Frontend:** HTML5, CSS3, vanilla JavaScript (`fetch`)
- **Tests:** Node's built-in test runner (`node --test`)
- **Storage:** in-memory (data is lost when the process restarts)

## Getting started

```bash
npm install
npm start
```

Then open http://localhost:3000. Set `PORT` to use a different port.

Development with auto-restart:

```bash
npm run dev
```

Run the tests:

```bash
npm test
```

## Todo model

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | UUID, server-generated |
| `title` | string | Required, trimmed, 1-200 characters |
| `description` | string | Optional, trimmed, up to 2000 characters, defaults to `""` |
| `status` | string | `todo` or `done`, defaults to `todo` |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

## API

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `200` | `{ "status": "ok" }` |
| `GET` | `/api/todos` | `200` | Array, oldest first |
| `GET` | `/api/todos/:id` | `200` | `404` if unknown |
| `POST` | `/api/todos` | `201` | Sets `Location`; `400` on validation errors |
| `PUT` | `/api/todos/:id` | `200` | Partial update; `400` / `404` |
| `DELETE` | `/api/todos/:id` | `204` | `404` if unknown |

Errors are returned as `{ "error": "message" }`.

### Examples

```bash
# Create
curl -X POST http://localhost:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","description":"Semi-skimmed"}'

# Mark done (any subset of title/description/status is accepted)
curl -X PUT http://localhost:3000/api/todos/<id> \
  -H 'Content-Type: application/json' \
  -d '{"status":"done"}'

# Delete
curl -X DELETE http://localhost:3000/api/todos/<id>
```

## Project structure

```
test-ai/
├── public/
│   ├── index.html      # UI markup
│   ├── style.css       # Styling
│   └── script.js       # Client-side logic
├── src/
│   ├── app.js          # Express app and routes
│   └── todoStore.js    # In-memory store and validation
├── test/
│   └── api.test.js     # API tests
├── .github/workflows/ci.yml
├── server.js           # Entrypoint
└── package.json
```

## CI

GitHub Actions runs `npm ci`, `npm test`, and a server smoke test on Node 20 and 22 for every push and pull request.

## License

MIT
