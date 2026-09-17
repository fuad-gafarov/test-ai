'use strict';

(() => {
  const API = '/api/todos';

  const form = document.getElementById('new-todo-form');
  const titleInput = document.getElementById('title');
  const descriptionInput = document.getElementById('description');
  const listEl = document.getElementById('todo-list');
  const emptyEl = document.getElementById('empty');
  const errorEl = document.getElementById('error');
  const countsEl = document.getElementById('counts');
  const template = document.getElementById('todo-template');

  let todos = [];

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 204) return null;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error ?? `Request failed (${response.status})`);
    }
    return payload;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  function render() {
    listEl.replaceChildren();

    for (const todo of todos) {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.id = todo.id;
      node.classList.toggle('todo--done', todo.status === 'done');

      const toggle = node.querySelector('.todo__toggle');
      toggle.checked = todo.status === 'done';
      toggle.setAttribute('aria-label', `Mark "${todo.title}" as done`);

      node.querySelector('.todo__title').textContent = todo.title;

      const descriptionEl = node.querySelector('.todo__description');
      descriptionEl.textContent = todo.description;
      descriptionEl.hidden = todo.description.length === 0;

      node.querySelector('.todo__edit-title').value = todo.title;
      node.querySelector('.todo__edit-description').value = todo.description;

      listEl.append(node);
    }

    emptyEl.hidden = todos.length > 0;

    const done = todos.filter((todo) => todo.status === 'done').length;
    countsEl.textContent = `${todos.length - done} open · ${done} done`;
  }

  function setEditing(item, editing) {
    item.querySelector('.todo__edit').hidden = !editing;
    item.querySelector('.todo__main').hidden = editing;
    item.querySelector('.todo__actions').hidden = editing;
    if (editing) item.querySelector('.todo__edit-title').focus();
  }

  async function load() {
    try {
      todos = await request(API);
      clearError();
      render();
    } catch (err) {
      showError(`Could not load todos: ${err.message}`);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (title.length === 0) {
      showError('Title is required.');
      return;
    }

    try {
      const created = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: descriptionInput.value.trim() }),
      });
      todos.push(created);
      form.reset();
      titleInput.focus();
      clearError();
      render();
    } catch (err) {
      showError(`Could not add todo: ${err.message}`);
    }
  });

  listEl.addEventListener('change', async (event) => {
    const toggle = event.target.closest('.todo__toggle');
    if (!toggle) return;

    const item = toggle.closest('.todo');
    const status = toggle.checked ? 'done' : 'todo';
    try {
      const updated = await request(`${API}/${item.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      todos = todos.map((todo) => (todo.id === updated.id ? updated : todo));
      clearError();
      render();
    } catch (err) {
      showError(`Could not update todo: ${err.message}`);
      load();
    }
  });

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const item = button.closest('.todo');
    const id = item.dataset.id;

    if (button.dataset.action === 'edit') {
      setEditing(item, true);
      return;
    }

    if (button.dataset.action === 'cancel') {
      setEditing(item, false);
      return;
    }

    if (button.dataset.action === 'delete') {
      const todo = todos.find((candidate) => candidate.id === id);
      if (!window.confirm(`Delete "${todo?.title ?? 'this todo'}"?`)) return;
      try {
        await request(`${API}/${id}`, { method: 'DELETE' });
        todos = todos.filter((candidate) => candidate.id !== id);
        clearError();
        render();
      } catch (err) {
        showError(`Could not delete todo: ${err.message}`);
      }
    }
  });

  listEl.addEventListener('submit', async (event) => {
    const editForm = event.target.closest('.todo__edit');
    if (!editForm) return;
    event.preventDefault();

    const item = editForm.closest('.todo');
    const title = item.querySelector('.todo__edit-title').value.trim();
    const description = item.querySelector('.todo__edit-description').value.trim();

    if (title.length === 0) {
      showError('Title is required.');
      return;
    }

    try {
      const updated = await request(`${API}/${item.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      todos = todos.map((todo) => (todo.id === updated.id ? updated : todo));
      clearError();
      render();
    } catch (err) {
      showError(`Could not save todo: ${err.message}`);
    }
  });

  load();
})();
