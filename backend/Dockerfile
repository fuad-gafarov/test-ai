FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace
COPY gradlew ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --version --no-daemon
COPY settings.gradle.kts build.gradle.kts ./
COPY src ./src
RUN ./gradlew bootJar --no-daemon
RUN cp build/libs/*.jar app.jar

FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown -R app:app /app
COPY --from=build --chown=app:app /workspace/app.jar /app/app.jar
USER app
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
