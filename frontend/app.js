// Point this at the deployed backend's URL (or leave relative if served from the same origin).
const API_BASE = window.API_BASE || "http://localhost:8080/api/todos";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const errorBox = document.getElementById("error");

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
}

async function fetchTodos() {
  clearError();
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`Failed to load todos (${res.status})`);
    const todos = await res.json();
    renderTodos(todos);
  } catch (err) {
    showError(err.message || "Could not reach the server.");
  }
}

function renderTodos(todos) {
  list.innerHTML = "";
  emptyState.hidden = todos.length !== 0;

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleTodo(todo));

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = todo.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, title, deleteBtn);
    list.appendChild(li);
  }
}

async function addTodo(title) {
  clearError();
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`Failed to add todo (${res.status})`);
    await fetchTodos();
  } catch (err) {
    showError(err.message || "Could not add todo.");
  }
}

async function toggleTodo(todo) {
  clearError();
  try {
    const res = await fetch(`${API_BASE}/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: todo.title, completed: !todo.completed }),
    });
    if (!res.ok) throw new Error(`Failed to update todo (${res.status})`);
    await fetchTodos();
  } catch (err) {
    showError(err.message || "Could not update todo.");
  }
}

async function deleteTodo(id) {
  clearError();
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete todo (${res.status})`);
    await fetchTodos();
  } catch (err) {
    showError(err.message || "Could not delete todo.");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  addTodo(title);
  input.value = "";
});

fetchTodos();
