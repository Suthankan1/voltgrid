FROM eclipse-temurin:25-jdk-noble AS build

WORKDIR /workspace/services/authorization-service

COPY services/authorization-service/.mvn .mvn
COPY services/authorization-service/mvnw services/authorization-service/pom.xml ./

RUN chmod +x mvnw \
    && ./mvnw -q -DskipTests dependency:go-offline

COPY contracts/authorization/v1 /workspace/contracts/authorization/v1
COPY services/authorization-service/src src

RUN ./mvnw -q -DskipTests package \
    && cp target/authorization-service-0.0.1-SNAPSHOT.jar application.jar \
    && java -Djarmode=tools \
        -jar application.jar \
        extract \
        --layers \
        --destination extracted


FROM ghcr.io/grpc-ecosystem/grpc-health-probe:v0.4.57 AS grpc-health-probe


FROM eclipse-temurin:25-jre-noble AS runtime

WORKDIR /application

RUN groupadd --system voltgrid \
    && useradd \
        --system \
        --gid voltgrid \
        --home-dir /application \
        --shell /usr/sbin/nologin \
        voltgrid

COPY --from=grpc-health-probe \
    /ko-app/grpc-health-probe /usr/local/bin/grpc_health_probe

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/authorization-service/extracted/dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/authorization-service/extracted/spring-boot-loader/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/authorization-service/extracted/snapshot-dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/authorization-service/extracted/application/ ./

USER voltgrid

EXPOSE 9090

ENTRYPOINT ["java", "-jar", "application.jar"]
