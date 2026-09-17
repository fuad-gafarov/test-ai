package com.example.todo;

import jakarta.validation.constraints.NotBlank;

public record UpdateTodoRequest(@NotBlank(message = "title must not be blank") String title, boolean completed) {
}
