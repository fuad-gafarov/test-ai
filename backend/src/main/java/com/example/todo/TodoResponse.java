package com.example.todo;

import java.time.Instant;

public record TodoResponse(Long id, String title, boolean completed, Instant createdAt) {

    public static TodoResponse from(Todo todo) {
        return new TodoResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt());
    }
}
