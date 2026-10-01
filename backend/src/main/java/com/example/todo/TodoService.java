package com.example.todo;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TodoService {

    static final int MAX_TITLE = 200;

    private final TodoFileRepository repository;

    public TodoService(TodoFileRepository repository) {
        this.repository = repository;
    }

    public List<Todo> list() {
        return repository.findAll();
    }

    public Todo create(String title) {
        return repository.create(validTitle(title));
    }

    public Todo update(long id, String title, boolean completed) {
        String t = validTitle(title);
        return repository.update(id, t, completed).orElseThrow(() -> new TodoNotFoundException(id));
    }

    public void delete(long id) {
        if (!repository.delete(id)) {
            throw new TodoNotFoundException(id);
        }
    }

    private static String validTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new InvalidTodoException("title must not be blank");
        }
        String t = title.strip();
        if (t.length() > MAX_TITLE) {
            throw new InvalidTodoException("title must be at most " + MAX_TITLE + " characters");
        }
        return t;
    }
}
