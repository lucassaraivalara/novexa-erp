FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
COPY src src
# Tests are a separate release gate; no credentials are supplied during image build.
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN groupadd --gid 10001 novexa && useradd --uid 10001 --gid novexa --no-create-home novexa
WORKDIR /app
COPY --from=build --chown=novexa:novexa /build/target/novexa-api-0.0.1-SNAPSHOT.jar app.jar
USER 10001:10001
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
