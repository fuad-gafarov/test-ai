import { useState } from 'react'
import { useTodoMutations, useTodosQuery } from '../hooks/useTodos'
import { AddTodoForm } from './AddTodoForm'
import { TodoItem } from './TodoItem'

type Filter = 'all' | 'active' | 'completed'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
]

export function TodoApp() {
  const [filter, setFilter] = useState<Filter>('all')
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, isPending, error, refetch } = useTodosQuery()
  const { create, update, remove } = useTodoMutations()

  const report = (e: unknown) => setActionError(e instanceof Error ? e.message : 'Something went wrong.')
  const run = (p: Promise<unknown>) => {
    setActionError(null)
    p.catch(report)
  }

  const todos = data ?? []
  const left = todos.filter((t) => !t.completed).length
  const completedCount = todos.length - left
  const visible = todos.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed,
  )

  return (
    <main className="app">
      <h1>Todos</h1>
      <AddTodoForm onAdd={(title) => create.mutateAsync(title)} />
      {actionError && <p role="alert" className="error">{actionError}</p>}

      {isPending ? (
        <p role="status">Loading…</p>
      ) : error ? (
        <div role="alert" className="error">
          <p>Failed to load todos: {error.message}</p>
          <button type="button" onClick={() => void refetch()}>Retry</button>
        </div>
      ) : (
        <>
          {visible.length === 0 ? (
            <p className="empty">
              {todos.length === 0 ? 'No todos yet. Add one above!' : 'No todos match this filter.'}
            </p>
          ) : (
            <ul className="list">
              {visible.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={(t) => run(update.mutateAsync({ id: t.id, title: t.title, completed: !t.completed }))}
                  onRename={(t, title) =>
                    update.mutateAsync({ id: t.id, title: title.trim(), completed: t.completed })
                  }
                  onDelete={(t) => run(remove.mutateAsync(t.id))}
                />
              ))}
            </ul>
          )}
          <footer className="footer">
            <span>{left === 1 ? '1 item left' : `${left} items left`}</span>
            <div role="group" aria-label="Filter todos" className="filters">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={completedCount === 0}
              onClick={() =>
                run(Promise.all(todos.filter((t) => t.completed).map((t) => remove.mutateAsync(t.id))))
              }
            >
              Clear completed
            </button>
          </footer>
        </>
      )}
    </main>
  )
}
