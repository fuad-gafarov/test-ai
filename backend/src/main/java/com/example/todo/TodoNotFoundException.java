package com.example.todo;

public class TodoNotFoundException extends RuntimeException {
    public TodoNotFoundException(long id) {
        super("Todo " + id + " not found");
    }
}
