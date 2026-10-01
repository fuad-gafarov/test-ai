import { useState, type FormEvent } from 'react'
import { MAX_TITLE, validateTitle } from '../validation'

interface Props {
  onAdd: (title: string) => Promise<unknown>
}

export function AddTodoForm({ onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateTitle(title)
    if (err) return setError(err)
    setBusy(true)
    try {
      await onAdd(title.trim())
      setTitle('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add todo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="add">
      <label htmlFor="new-todo" className="sr-only">New todo</label>
      <input
        id="new-todo"
        value={title}
        placeholder="What needs to be done?"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'new-todo-error' : undefined}
        onChange={(e) => {
          setTitle(e.target.value)
          if (error) setError(null)
        }}
      />
      <button type="submit" disabled={busy}>Add</button>
      {error && <p id="new-todo-error" role="alert" className="error">{error}</p>}
      <span className="sr-only" aria-live="polite">{title.length > MAX_TITLE ? 'Too long' : ''}</span>
    </form>
  )
}
