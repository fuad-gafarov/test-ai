package com.example.todo;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TodoFileRepositoryTest {

    @TempDir
    Path dir;

    @Test
    void createsMissingFileAndParents() {
        Path f = dir.resolve("a/b/todos.txt");
        new TodoFileRepository(f);
        assertThat(f).exists();
    }

    @Test
    void roundTripsSpecialCharacters() {
        Path f = dir.resolve("todos.txt");
        String weird = "a\tb\nc\\d\\n\\t end\r";
        TodoFileRepository repo = new TodoFileRepository(f);
        Todo created = repo.create(weird);
        repo.update(created.id(), weird, true);

        List<Todo> loaded = new TodoFileRepository(f).findAll();
        assertThat(loaded).hasSize(1);
        assertThat(loaded.get(0).title()).isEqualTo(weird);
        assertThat(loaded.get(0).completed()).isTrue();
        assertThat(loaded.get(0).createdAt()).isEqualTo(created.createdAt());
        assertThat(lines(f)).hasSize(1);
    }

    @Test
    void idsAreMaxPlusOneAndDeleteWorks() {
        Path f = dir.resolve("todos.txt");
        TodoFileRepository repo = new TodoFileRepository(f);
        repo.create("one");
        Todo two = repo.create("two");
        Todo three = repo.create("three");
        assertThat(three.id()).isEqualTo(3);
        assertThat(repo.delete(1)).isTrue();
        assertThat(repo.delete(1)).isFalse();
        repo.delete(three.id());
        assertThat(new TodoFileRepository(f).create("x").id()).isEqualTo(two.id() + 1);
        assertThat(repo.update(99, "x", true)).isEmpty();
    }

    private static List<String> lines(Path f) {
        try {
            return Files.readAllLines(f);
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}
