package com.example.todo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TodoControllerTest {

    private final MockMvc mockMvc;
    private final TodoRepository repository;

    @Autowired
    TodoControllerTest(MockMvc mockMvc, TodoRepository repository) {
        this.mockMvc = mockMvc;
        this.repository = repository;
    }

    @BeforeEach
    void clearDatabase() {
        repository.deleteAll();
    }

    @Test
    void createsTodoAndReturns201() throws Exception {
        mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Buy milk"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("Buy milk"))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void rejectsBlankTitleWith400() throws Exception {
        mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("title: title must not be blank"));
    }

    @Test
    void listsAllTodos() throws Exception {
        createTodo("first");
        createTodo("second");

        mockMvc.perform(get("/api/todos"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("first"))
                .andExpect(jsonPath("$[1].title").value("second"));
    }

    @Test
    void getsSingleTodo() throws Exception {
        long id = createTodo("read me");

        mockMvc.perform(get("/api/todos/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id))
                .andExpect(jsonPath("$.title").value("read me"));
    }

    @Test
    void returns404ForUnknownTodo() throws Exception {
        mockMvc.perform(get("/api/todos/{id}", 9999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Todo with id 9999 not found"));
    }

    @Test
    void updatesTodo() throws Exception {
        long id = createTodo("old title");

        mockMvc.perform(put("/api/todos/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "new title", "completed": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id))
                .andExpect(jsonPath("$.title").value("new title"))
                .andExpect(jsonPath("$.completed").value(true));

        mockMvc.perform(get("/api/todos/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("new title"))
                .andExpect(jsonPath("$.completed").value(true));
    }

    @Test
    void returns404WhenUpdatingUnknownTodo() throws Exception {
        mockMvc.perform(put("/api/todos/{id}", 9999)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "nope", "completed": false}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void returns400WhenUpdatingWithBlankTitle() throws Exception {
        long id = createTodo("keep me");

        mockMvc.perform(put("/api/todos/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "completed": true}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deletesTodo() throws Exception {
        long id = createTodo("delete me");

        mockMvc.perform(delete("/api/todos/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/todos/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void returns404WhenDeletingUnknownTodo() throws Exception {
        mockMvc.perform(delete("/api/todos/{id}", 9999))
                .andExpect(status().isNotFound());
    }

    @Test
    void healthEndpointReturns200() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void allowsCrossOriginRequests() throws Exception {
        mockMvc.perform(get("/api/todos").header("Origin", "http://example.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://example.com"));
    }

    private long createTodo(String title) throws Exception {
        String body = mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"" + title + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }
}
