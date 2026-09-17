'use strict';

const { randomUUID } = require('node:crypto');

const STATUSES = Object.freeze(['todo', 'done']);
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

/**
 * Error carrying an HTTP status code, thrown by validation/lookup helpers.
 */
class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

/**
 * Simple in-memory todo store. State lives for the lifetime of the process.
 */
class TodoStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.todos = new Map();
  }

  list() {
    return [...this.todos.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(id) {
    return this.todos.get(id) ?? null;
  }

  create({ title, description, status }) {
    const now = new Date().toISOString();
    const todo = {
      id: randomUUID(),
      title: normalizeTitle(title, { required: true }),
      description: normalizeDescription(description ?? ''),
      status: normalizeStatus(status ?? 'todo'),
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  update(id, patch) {
    const existing = this.todos.get(id);
    if (!existing) return null;

    const hasField = ['title', 'description', 'status'].some((key) =>
      Object.prototype.hasOwnProperty.call(patch, key),
    );
    if (!hasField) {
      throw new ValidationError('Provide at least one of: title, description, status');
    }

    const updated = { ...existing };
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
      updated.title = normalizeTitle(patch.title, { required: true });
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
      updated.description = normalizeDescription(patch.description ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
      updated.status = normalizeStatus(patch.status);
    }
    updated.updatedAt = new Date().toISOString();

    this.todos.set(id, updated);
    return updated;
  }

  remove(id) {
    return this.todos.delete(id);
  }

  clear() {
    this.todos.clear();
  }
}

function normalizeTitle(value, { required }) {
  if (typeof value !== 'string') {
    throw new ValidationError('title must be a string');
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new ValidationError('title is required and cannot be empty');
  }
  if (trimmed.length > TITLE_MAX) {
    throw new ValidationError(`title must be ${TITLE_MAX} characters or fewer`);
  }
  return trimmed;
}

function normalizeDescription(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('description must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length > DESCRIPTION_MAX) {
    throw new ValidationError(`description must be ${DESCRIPTION_MAX} characters or fewer`);
  }
  return trimmed;
}

function normalizeStatus(value) {
  if (typeof value !== 'string' || !STATUSES.includes(value)) {
    throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}`);
  }
  return value;
}

module.exports = { TodoStore, ValidationError, STATUSES, TITLE_MAX, DESCRIPTION_MAX };
