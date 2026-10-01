import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTodo, deleteTodo, listTodos, updateTodo, type TodoInput } from '../api/todos'

const KEY = ['todos']

export function useTodosQuery() {
  return useQuery({ queryKey: KEY, queryFn: listTodos })
}

export function useTodoMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY })
  const create = useMutation({ mutationFn: (title: string) => createTodo(title), onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, ...input }: TodoInput & { id: number }) => updateTodo(id, input),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: number) => deleteTodo(id), onSuccess: invalidate })
  return { create, update, remove }
}
