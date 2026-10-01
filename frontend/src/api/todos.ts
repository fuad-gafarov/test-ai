export interface Todo {
  id: number
  title: string
  completed: boolean
  createdAt: string
}

export interface TodoInput {
  title: string
  completed: boolean
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Could not reach the server.', 0)
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const problem = (await res.json()) as { detail?: string; title?: string }
      message = problem.detail || problem.title || message
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const listTodos = () => request<Todo[]>('/api/todos')

export const createTodo = (title: string) =>
  request<Todo>('/api/todos', { method: 'POST', body: JSON.stringify({ title }) })

export const updateTodo = (id: number, input: TodoInput) =>
  request<Todo>(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteTodo = (id: number) =>
  request<void>(`/api/todos/${id}`, { method: 'DELETE' })
