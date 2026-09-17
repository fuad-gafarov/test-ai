package com.example.todo;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TodoService {

    private final TodoRepository repository;

    public TodoService(TodoRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TodoResponse> findAll() {
        return repository.findAllByOrderByCreatedAtAscIdAsc().stream()
                .map(TodoResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TodoResponse findById(Long id) {
        return repository.findById(id)
                .map(TodoResponse::from)
                .orElseThrow(() -> new TodoNotFoundException(id));
    }

    @Transactional
    public TodoResponse create(CreateTodoRequest request) {
        return TodoResponse.from(repository.save(new Todo(request.title())));
    }

    @Transactional
    public TodoResponse update(Long id, UpdateTodoRequest request) {
        Todo todo = repository.findById(id).orElseThrow(() -> new TodoNotFoundException(id));
        todo.setTitle(request.title());
        todo.setCompleted(request.completed());
        return TodoResponse.from(repository.save(todo));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new TodoNotFoundException(id);
        }
        repository.deleteById(id);
    }
}
