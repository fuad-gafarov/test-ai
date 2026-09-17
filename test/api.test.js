'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { TodoStore } = require('../src/todoStore');

const store = new TodoStore();
const app = createApp({ store });
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  store.clear();
});

function api(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

function postJson(path, body) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function putJson(path, body) {
  return api(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seed(body = { title: 'Buy milk', description: 'Semi-skimmed' }) {
  const response = await postJson('/api/todos', body);
  assert.equal(response.status, 201);
  return response.json();
}

test('GET /api/health reports ok', async () => {
  const response = await api('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /api/todos starts empty', async () => {
  const response = await api('/api/todos');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test('POST /api/todos creates a todo with defaults and Location header', async () => {
  const response = await postJson('/api/todos', { title: '  Write tests  ' });
  assert.equal(response.status, 201);

  const todo = await response.json();
  assert.equal(todo.title, 'Write tests');
  assert.equal(todo.description, '');
  assert.equal(todo.status, 'todo');
  assert.ok(todo.id);
  assert.equal(todo.createdAt, todo.updatedAt);
  assert.equal(response.headers.get('location'), `/api/todos/${todo.id}`);
});

test('POST /api/todos accepts an explicit status', async () => {
  const response = await postJson('/api/todos', { title: 'Already handled', status: 'done' });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'done');
});

test('POST /api/todos rejects missing, blank and oversized titles', async () => {
  for (const body of [{}, { title: '   ' }, { title: 'x'.repeat(201) }, { title: 42 }]) {
    const response = await postJson('/api/todos', body);
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assert.ok((await response.json()).error);
  }
});

test('POST /api/todos rejects an invalid status', async () => {
  const response = await postJson('/api/todos', { title: 'Nope', status: 'in-progress' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /status must be one of/);
});

test('POST /api/todos rejects malformed JSON and non-object bodies', async () => {
  const malformed = await api('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"title":',
  });
  assert.equal(malformed.status, 400);

  const array = await postJson('/api/todos', [{ title: 'nope' }]);
  assert.equal(array.status, 400);
});

test('GET /api/todos returns created todos in creation order', async () => {
  const first = await seed({ title: 'First' });
  const second = await seed({ title: 'Second' });

  const response = await api('/api/todos');
  const list = await response.json();
  assert.deepEqual(
    list.map((todo) => todo.id),
    [first.id, second.id],
  );
});

test('GET /api/todos/:id returns one todo, 404 when unknown', async () => {
  const todo = await seed();

  const found = await api(`/api/todos/${todo.id}`);
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), todo);

  const missing = await api('/api/todos/does-not-exist');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Todo not found' });
});

test('PUT /api/todos/:id updates status only, leaving other fields intact', async () => {
  const todo = await seed();
  const response = await putJson(`/api/todos/${todo.id}`, { status: 'done' });
  assert.equal(response.status, 200);

  const updated = await response.json();
  assert.equal(updated.status, 'done');
  assert.equal(updated.title, todo.title);
  assert.equal(updated.description, todo.description);
  assert.equal(updated.createdAt, todo.createdAt);
  assert.ok(updated.updatedAt >= todo.updatedAt);
});

test('PUT /api/todos/:id updates title and description', async () => {
  const todo = await seed();
  const response = await putJson(`/api/todos/${todo.id}`, {
    title: 'Buy oat milk',
    description: '',
  });
  const updated = await response.json();
  assert.equal(updated.title, 'Buy oat milk');
  assert.equal(updated.description, '');
  assert.equal(updated.status, 'todo');
});

test('PUT /api/todos/:id rejects empty patches and invalid values', async () => {
  const todo = await seed();

  const empty = await putJson(`/api/todos/${todo.id}`, {});
  assert.equal(empty.status, 400);
  assert.match((await empty.json()).error, /at least one of/);

  const badTitle = await putJson(`/api/todos/${todo.id}`, { title: '  ' });
  assert.equal(badTitle.status, 400);

  const badStatus = await putJson(`/api/todos/${todo.id}`, { status: 'archived' });
  assert.equal(badStatus.status, 400);
});

test('PUT /api/todos/:id returns 404 for an unknown id', async () => {
  const response = await putJson('/api/todos/nope', { status: 'done' });
  assert.equal(response.status, 404);
});

test('DELETE /api/todos/:id removes the todo and 404s afterwards', async () => {
  const todo = await seed();

  const first = await api(`/api/todos/${todo.id}`, { method: 'DELETE' });
  assert.equal(first.status, 204);
  assert.equal(await first.text(), '');

  const second = await api(`/api/todos/${todo.id}`, { method: 'DELETE' });
  assert.equal(second.status, 404);

  const list = await (await api('/api/todos')).json();
  assert.deepEqual(list, []);
});

test('unknown API routes return JSON 404', async () => {
  const response = await api('/api/unknown');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('static frontend is served at the root', async () => {
  const response = await api('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /<title>Todo List<\/title>/);
});

test('stylesheet and script are served, and [hidden] is honoured', async () => {
  const script = await api('/script.js');
  assert.equal(script.status, 200);

  const css = await api('/style.css');
  assert.equal(css.status, 200);
  // Regression guard: .todo__edit / .todo__main set `display`, which beats the
  // user-agent rule for the `hidden` attribute unless we override it.
  assert.match(await css.text(), /\[hidden\]\s*{\s*display:\s*none\s*!important/);
});
