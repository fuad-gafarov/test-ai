package com.example.todo;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService service;

    public TodoController(TodoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Todo> list() {
        return service.list();
    }

    @PostMapping
    public ResponseEntity<Todo> create(@Valid @RequestBody CreateTodoRequest request) {
        Todo todo = service.create(request.title());
        return ResponseEntity.created(URI.create("/api/todos/" + todo.id())).body(todo);
    }

    @PutMapping("/{id}")
    public Todo update(@PathVariable long id, @Valid @RequestBody UpdateTodoRequest request) {
        return service.update(id, request.title(), request.completed());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
