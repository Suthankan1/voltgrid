package com.voltgrid.operations.projection.station;

import com.voltgrid.operations.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@Import(PostgresTestConfiguration.class)
class StationStatusProjectionRepositoryIntegrationTests {

    @Autowired
    private StationStatusProjectionRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void shouldPersistAndReadStationStatusProjection() {
        var eventId =
                UUID.randomUUID();

        var statusChangedAt =
                Instant.parse(
                        "2026-09-13T17:00:00Z"
                );

        var updatedAt =
                Instant.parse(
                        "2026-09-13T17:00:01Z"
                );

        repository.saveAndFlush(
                new StationStatusProjectionEntity(
                        "STATION-001",
                        "ONLINE",
                        eventId,
                        statusChangedAt,
                        updatedAt
                )
        );

        var projection =
                repository
                        .findById(
                                "STATION-001"
                        )
                        .orElseThrow();

        assertThat(
                projection.getStationId()
        ).isEqualTo(
                "STATION-001"
        );

        assertThat(
                projection.getCurrentStatus()
        ).isEqualTo(
                "ONLINE"
        );

        assertThat(
                projection.getLastEventId()
        ).isEqualTo(
                eventId
        );

        assertThat(
                projection.getStatusChangedAt()
        ).isEqualTo(
                statusChangedAt
        );

        assertThat(
                projection.getUpdatedAt()
        ).isEqualTo(
                updatedAt
        );
    }

    @Test
    void shouldReplaceExistingProjectionForSameStation() {
        var first =
                new StationStatusProjectionEntity(
                        "STATION-001",
                        "OFFLINE",
                        UUID.randomUUID(),
                        Instant.parse(
                                "2026-09-13T16:00:00Z"
                        ),
                        Instant.parse(
                                "2026-09-13T16:00:01Z"
                        )
                );

        repository.saveAndFlush(
                first
        );

        assertThat(
                repository.count()
        ).isEqualTo(
                1
        );
    }
}