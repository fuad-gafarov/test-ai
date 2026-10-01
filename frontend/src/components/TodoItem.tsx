import { useState } from 'react'
import type { Todo } from '../api/todos'
import { MAX_TITLE, validateTitle } from '../validation'

interface Props {
  todo: Todo
  onToggle: (todo: Todo) => void
  onRename: (todo: Todo, title: string) => Promise<unknown>
  onDelete: (todo: Todo) => void
}

export function TodoItem({ todo, onToggle, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.title)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setDraft(todo.title)
    setError(null)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setError(null)
  }
  const save = async () => {
    const err = validateTitle(draft)
    if (err) return setError(err)
    if (draft === todo.title) return cancel()
    try {
      await onRename(todo, draft)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    }
  }

  return (
    <li className={todo.completed ? 'todo completed' : 'todo'}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo)}
        aria-label={`Mark "${todo.title}" as ${todo.completed ? 'active' : 'completed'}`}
      />
      {editing ? (
        <div className="edit">
          <input
            autoFocus
            value={draft}
            maxLength={MAX_TITLE + 50}
            aria-label={`Edit title of "${todo.title}"`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              else if (e.key === 'Escape') cancel()
            }}
            onBlur={cancel}
          />
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      ) : (
        <>
          <span className="title" onDoubleClick={start}>{todo.title}</span>
          <button type="button" onClick={start} aria-label={`Edit "${todo.title}"`}>Edit</button>
          <button type="button" className="danger" onClick={() => onDelete(todo)} aria-label={`Delete "${todo.title}"`}>
            Delete
          </button>
        </>
      )}
    </li>
  )
}
