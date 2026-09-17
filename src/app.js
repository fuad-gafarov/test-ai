'use strict';

const path = require('node:path');
const express = require('express');
const { TodoStore, ValidationError } = require('./todoStore');

/**
 * Builds the Express application.
 * @param {{ store?: TodoStore }} [options]
 */
function createApp({ store = new TodoStore() } = {}) {
  const app = express();

  app.use(express.json({ limit: '64kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.locals.store = store;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/todos', (req, res) => {
    res.json(store.list());
  });

  app.get('/api/todos/:id', (req, res) => {
    const todo = store.get(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  app.post('/api/todos', (req, res, next) => {
    try {
      const body = requireObjectBody(req.body);
      const todo = store.create(body);
      res.status(201).location(`/api/todos/${todo.id}`).json(todo);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/todos/:id', (req, res, next) => {
    try {
      const body = requireObjectBody(req.body);
      const todo = store.update(req.params.id, body);
      if (!todo) return res.status(404).json({ error: 'Todo not found' });
      res.json(todo);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/todos/:id', (req, res) => {
    const deleted = store.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Todo not found' });
    res.status(204).end();
  });

  // Unknown API routes must answer with JSON, not the static index.html.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function requireObjectBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body;
}

module.exports = { createApp };
