package com.example.todo;

public class InvalidTodoException extends RuntimeException {
    public InvalidTodoException(String message) {
        super(message);
    }
}
