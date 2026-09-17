package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.tester.AutoConfigureHttpGraphQlTester;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.test.tester.HttpGraphQlTester;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(
        webEnvironment = RANDOM_PORT,
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@AutoConfigureHttpGraphQlTester
@Import(PostgresTestConfiguration.class)
class StationStatusGraphQlE2EIntegrationTests {

    @Autowired
    private HttpGraphQlTester graphQlTester;

    @Autowired
    private StationStatusProjectionRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void shouldReturnPersistedStationStatusOverHttpGraphQl() {
        var eventId =
                UUID.randomUUID();

        repository.save(
                new StationStatusProjectionEntity(
                        "STATION-GRAPHQL-001",
                        "ONLINE",
                        eventId,
                        Instant.parse(
                                "2026-09-17T06:30:00Z"
                        ),
                        Instant.parse(
                                "2026-09-17T06:30:01Z"
                        )
                )
        );

        graphQlTester
                .document(
                        """
                        query StationStatus($stationId: ID!) {
                          stationStatus(stationId: $stationId) {
                            stationId
                            currentStatus
                            lastEventId
                            statusChangedAt
                            updatedAt
                          }
                        }
                        """
                )
                .variable(
                        "stationId",
                        "STATION-GRAPHQL-001"
                )
                .execute()
                .path(
                        "stationStatus.stationId"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "STATION-GRAPHQL-001"
                )
                .path(
                        "stationStatus.currentStatus"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "ONLINE"
                )
                .path(
                        "stationStatus.lastEventId"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        eventId.toString()
                )
                .path(
                        "stationStatus.statusChangedAt"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "2026-09-17T06:30:00Z"
                )
                .path(
                        "stationStatus.updatedAt"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "2026-09-17T06:30:01Z"
                );
    }

    @Test
    void shouldReturnNullWhenStationProjectionDoesNotExist() {
        graphQlTester
                .document(
                        """
                        query StationStatus($stationId: ID!) {
                          stationStatus(stationId: $stationId) {
                            stationId
                            currentStatus
                          }
                        }
                        """
                )
                .variable(
                        "stationId",
                        "UNKNOWN-STATION"
                )
                .execute()
                .path(
                        "stationStatus"
                )
                .valueIsNull();
    }
}