package com.example.todo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class TodoControllerTest {

    @TempDir
    static Path dir;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("todo.data-file", () -> dir.resolve("todos.txt").toString());
    }

    @Autowired
    MockMvc mvc;

    private String create(String json) throws Exception {
        return mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content(json))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void createTrimsAndReturns201() throws Exception {
        mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"  Buy milk  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("Buy milk"))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.createdAt").isString());
    }

    @Test
    void createRejectsInvalidTitles() throws Exception {
        for (String body : new String[] {"{}", "{\"title\":null}", "{\"title\":\"   \"}",
                "{\"title\":\"" + "x".repeat(201) + "\"}", "not json"}) {
            mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        }
        mvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + "x".repeat(200) + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void listIsOrderedById() throws Exception {
        create("{\"title\":\"a\"}");
        create("{\"title\":\"b\"}");
        mvc.perform(get("/api/todos")).andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].id").value(org.hamcrest.Matchers.lessThan(2147483647)));
    }

    @Test
    void updateAndDelete() throws Exception {
        String res = create("{\"title\":\"x\"}");
        String id = res.replaceAll(".*\"id\":(\\d+).*", "$1");
        mvc.perform(put("/api/todos/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"y\",\"completed\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("y"))
                .andExpect(jsonPath("$.completed").value(true));
        mvc.perform(put("/api/todos/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\" \",\"completed\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/todos/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"y\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/todos/" + id)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/todos/" + id)).andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void updateMissingIs404() throws Exception {
        mvc.perform(put("/api/todos/987654").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"y\",\"completed\":true}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void corsAllowsViteOrigin() throws Exception {
        mvc.perform(options("/api/todos").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
