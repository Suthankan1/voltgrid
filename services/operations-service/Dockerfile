FROM eclipse-temurin:25-jdk-noble AS build

WORKDIR /workspace/services/operations-service

COPY services/operations-service/.mvn .mvn
COPY services/operations-service/mvnw services/operations-service/pom.xml ./

RUN chmod +x mvnw \
    && ./mvnw -q -DskipTests dependency:go-offline

COPY services/operations-service/src src

RUN ./mvnw -q -DskipTests package \
    && cp target/operations-service-0.0.1-SNAPSHOT.jar application.jar \
    && java -Djarmode=tools \
        -jar application.jar \
        extract \
        --layers \
        --destination extracted


FROM eclipse-temurin:25-jre-noble AS runtime

WORKDIR /application

RUN groupadd --system voltgrid \
    && useradd \
        --system \
        --gid voltgrid \
        --home-dir /application \
        --shell /usr/sbin/nologin \
        voltgrid

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/operations-service/extracted/dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/operations-service/extracted/spring-boot-loader/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/operations-service/extracted/snapshot-dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/operations-service/extracted/application/ ./

USER voltgrid

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "application.jar"]