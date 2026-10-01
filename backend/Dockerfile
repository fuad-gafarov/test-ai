# syntax=docker/dockerfile:1
# ---- build stage: JDK 25 + Gradle wrapper (Gradle 9.1) ----
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Copy wrapper + build scripts first so dependency resolution is cached
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --no-daemon --console=plain dependencies > /dev/null

COPY src ./src
RUN ./gradlew --no-daemon --console=plain bootJar -x test \
    && cp build/libs/*.jar app.jar \
    && ls -l app.jar

# ---- runtime stage: JRE 25, non-root ----
FROM eclipse-temurin:25-jre
# Fixed uid/gid so the EFS access point (uid/gid 10001) owns /data for this user
RUN groupadd --system --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /data && chown app:app /data
WORKDIR /app
COPY --from=build --chown=app:app /workspace/app.jar app.jar
USER 10001:10001
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
# Default data file; ECS overrides it with --todo.data-file=/data/todos.txt
CMD ["--todo.data-file=/data/todos.txt"]
