package com.example.todo;

import jakarta.validation.constraints.NotNull;

public record UpdateTodoRequest(String title, @NotNull Boolean completed) {}
