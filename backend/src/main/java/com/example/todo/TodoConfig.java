package com.example.todo;

import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class TodoConfig implements WebMvcConfigurer {

    private final String allowedOrigin;

    public TodoConfig(@Value("${todo.cors-allowed-origin:http://localhost:5173}") String allowedOrigin) {
        this.allowedOrigin = allowedOrigin;
    }

    @Bean
    TodoFileRepository todoFileRepository(@Value("${todo.data-file:./data/todos.txt}") String dataFile) {
        return new TodoFileRepository(Path.of(dataFile));
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigin)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
