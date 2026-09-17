FROM eclipse-temurin:25-jdk-noble AS build

WORKDIR /workspace/services/station-service

COPY services/station-service/.mvn .mvn
COPY services/station-service/mvnw services/station-service/pom.xml ./

RUN chmod +x mvnw \
    && ./mvnw -q -DskipTests dependency:go-offline

COPY contracts/authorization/v1 /workspace/contracts/authorization/v1
COPY services/station-service/src src

RUN ./mvnw -q -DskipTests package \
    && cp target/station-service-0.0.1-SNAPSHOT.jar application.jar \
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
    /workspace/services/station-service/extracted/dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/station-service/extracted/spring-boot-loader/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/station-service/extracted/snapshot-dependencies/ ./

COPY --from=build \
    --chown=voltgrid:voltgrid \
    /workspace/services/station-service/extracted/application/ ./

USER voltgrid

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "application.jar"]