import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/todos'
import { TodoApp } from './TodoApp'

vi.mock('../api/todos')
const mocked = vi.mocked(api)

let store: api.Todo[]
const mk = (id: number, title: string, completed = false): api.Todo => ({
  id, title, completed, createdAt: '2024-01-01T00:00:00Z',
})

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><TodoApp /></QueryClientProvider>)
}

beforeEach(() => {
  store = [mk(1, 'Buy milk'), mk(2, 'Walk dog', true)]
  mocked.listTodos.mockImplementation(async () => [...store])
  mocked.createTodo.mockImplementation(async (title) => {
    const t = mk(3, title)
    store.push(t)
    return t
  })
  mocked.updateTodo.mockImplementation(async (id, input) => {
    store = store.map((t) => (t.id === id ? { ...t, ...input } : t))
    return store.find((t) => t.id === id)!
  })
  mocked.deleteTodo.mockImplementation(async (id) => {
    store = store.filter((t) => t.id !== id)
  })
})

describe('TodoApp', () => {
  it('renders the list and items left', async () => {
    setup()
    expect(await screen.findByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByText('Walk dog')).toBeInTheDocument()
    expect(screen.getByText('1 item left')).toBeInTheDocument()
  })

  it('shows empty and error states', async () => {
    store = []
    setup()
    expect(await screen.findByText(/No todos yet/)).toBeInTheDocument()
  })

  it('shows load error', async () => {
    mocked.listTodos.mockRejectedValue(new Error('boom detail'))
    setup()
    expect(await screen.findByText(/boom detail/)).toBeInTheDocument()
  })

  it('adds a todo with Enter and validates blank input', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Buy milk')
    await user.type(screen.getByLabelText('New todo'), '   {Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(mocked.createTodo).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('New todo'), 'Write tests{Enter}')
    expect(await screen.findByText('Write tests')).toBeInTheDocument()
    expect(mocked.createTodo).toHaveBeenCalledWith('Write tests')
  })

  it('toggles completed', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByLabelText('Mark "Buy milk" as completed'))
    expect(mocked.updateTodo).toHaveBeenCalledWith(1, { title: 'Buy milk', completed: true })
    expect(await screen.findByText('0 items left')).toBeInTheDocument()
  })

  it('deletes a todo', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByLabelText('Delete "Buy milk"'))
    await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument())
    expect(mocked.deleteTodo).toHaveBeenCalledWith(1)
  })

  it('edits a title inline', async () => {
    const user = userEvent.setup()
    setup()
    await user.dblClick(await screen.findByText('Buy milk'))
    const input = screen.getByLabelText('Edit title of "Buy milk"')
    await user.clear(input)
    await user.type(input, 'Buy eggs{Enter}')
    expect(await screen.findByText('Buy eggs')).toBeInTheDocument()
  })

  it('filters todos', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Buy milk')
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.queryByText('Walk dog')).not.toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument()
    expect(screen.getByText('Walk dog')).toBeInTheDocument()
  })

  it('clears completed', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Walk dog')
    await user.click(screen.getByRole('button', { name: 'Clear completed' }))
    await waitFor(() => expect(screen.queryByText('Walk dog')).not.toBeInTheDocument())
    expect(within(screen.getByRole('list')).getByText('Buy milk')).toBeInTheDocument()
  })
})
