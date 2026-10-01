package com.example.todo;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.locks.ReentrantLock;

/** Stores todos in a tab-separated text file; whole file rewritten atomically on each change. */
public class TodoFileRepository {

    private final Path file;
    private final ReentrantLock lock = new ReentrantLock();
    private final TreeMap<Long, Todo> todos = new TreeMap<>();

    public TodoFileRepository(Path file) {
        this.file = file.toAbsolutePath();
        load();
    }

    public List<Todo> findAll() {
        lock.lock();
        try {
            return new ArrayList<>(todos.values());
        } finally {
            lock.unlock();
        }
    }

    public Optional<Todo> findById(long id) {
        lock.lock();
        try {
            return Optional.ofNullable(todos.get(id));
        } finally {
            lock.unlock();
        }
    }

    public Todo create(String title) {
        lock.lock();
        try {
            long id = todos.isEmpty() ? 1 : todos.lastKey() + 1;
            Todo todo = new Todo(id, title, false, Instant.now());
            todos.put(id, todo);
            persistOrRollback(id, null);
            return todo;
        } finally {
            lock.unlock();
        }
    }

    public Optional<Todo> update(long id, String title, boolean completed) {
        lock.lock();
        try {
            Todo old = todos.get(id);
            if (old == null) {
                return Optional.empty();
            }
            Todo updated = new Todo(id, title, completed, old.createdAt());
            todos.put(id, updated);
            persistOrRollback(id, old);
            return Optional.of(updated);
        } finally {
            lock.unlock();
        }
    }

    public boolean delete(long id) {
        lock.lock();
        try {
            Todo old = todos.remove(id);
            if (old == null) {
                return false;
            }
            persistOrRollback(id, old);
            return true;
        } finally {
            lock.unlock();
        }
    }

    /** Persists; on failure restores previous in-memory state for id (null = remove). */
    private void persistOrRollback(long id, Todo previous) {
        try {
            persist();
        } catch (RuntimeException e) {
            if (previous == null) {
                todos.remove(id);
            } else {
                todos.put(id, previous);
            }
            throw e;
        }
    }

    private void load() {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            if (!Files.exists(file)) {
                Files.createFile(file);
                return;
            }
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (line.isEmpty()) {
                    continue;
                }
                String[] p = line.split("\t", 4);
                if (p.length != 4) {
                    throw new IllegalStateException("Malformed todo line: " + line);
                }
                long id = Long.parseLong(p[0]);
                todos.put(id, new Todo(id, unescape(p[3]), Boolean.parseBoolean(p[1]), Instant.parse(p[2])));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load " + file, e);
        }
    }

    private void persist() {
        StringBuilder sb = new StringBuilder();
        for (Todo t : todos.values()) {
            sb.append(t.id()).append('\t').append(t.completed()).append('\t')
                    .append(t.createdAt()).append('\t').append(escape(t.title())).append('\n');
        }
        try {
            Path tmp = Files.createTempFile(file.getParent(), "todos", ".tmp");
            try {
                Files.writeString(tmp, sb, StandardCharsets.UTF_8);
                try {
                    Files.move(tmp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException e) {
                    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write " + file, e);
        }
    }

    static String escape(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '\\' -> sb.append("\\\\");
                case '\t' -> sb.append("\\t");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    static String unescape(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char n = s.charAt(++i);
                switch (n) {
                    case 't' -> sb.append('\t');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    default -> sb.append(n);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
