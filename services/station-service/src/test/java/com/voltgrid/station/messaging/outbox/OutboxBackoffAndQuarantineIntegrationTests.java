package com.voltgrid.station.messaging.outbox;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.security.require-auth=false"
        }
)
@Testcontainers
class OutboxBackoffAndQuarantineIntegrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18.6")
                    .withDatabaseName("voltgrid_station")
                    .withUsername("voltgrid")
                    .withPassword("voltgrid_dev");

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private OutboxEventRepository repository;

    @Autowired
    private OutboxRelayService relayService;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void shouldQuarantinePoisonEventWhenMaxRetriesExceededAndAllowReplay() {
        UUID poisonEventId = UUID.randomUUID();
        OutboxEventEntity poisonEvent = new OutboxEventEntity(
                poisonEventId,
                "ChargingStation",
                "STATION-POISON-001",
                "StationStatusChanged",
                "{\"stationId\":\"STATION-POISON-001\"}",
                Instant.now(),
                Instant.now()
        );

        // Record 5 failures
        for (int i = 0; i < 5; i++) {
            poisonEvent.recordFailure("Simulated broker rejection #" + (i + 1), Instant.now());
        }
        repository.save(poisonEvent);

        // Quarantined count check
        long quarantined = repository.countByPublishedAtIsNullAndRetryCountGreaterThanEqual(5);
        assertThat(quarantined).isEqualTo(1);

        // Querying for next unpublished should return EMPTY because it is quarantined
        var nextToPublish = repository.findNextUnpublishedForUpdate();
        assertThat(nextToPublish).isEmpty();

        // Safe operator replay operation
        int requeued = relayService.requeueQuarantinedEvents();
        assertThat(requeued).isEqualTo(1);

        // After replay, quarantined count becomes 0 and event is eligible again
        assertThat(repository.countByPublishedAtIsNullAndRetryCountGreaterThanEqual(5)).isEqualTo(0);
        var eligibleAgain = repository.findNextUnpublishedForUpdate();
        assertThat(eligibleAgain).isPresent();
        assertThat(eligibleAgain.get().getId()).isEqualTo(poisonEventId);
        assertThat(eligibleAgain.get().getRetryCount()).isEqualTo(0);
        assertThat(eligibleAgain.get().getLastError()).isNull();
    }

    @Test
    void shouldEnforceBackoffBeforeRetryingFailedEvent() {
        UUID eventId = UUID.randomUUID();
        OutboxEventEntity event = new OutboxEventEntity(
                eventId,
                "ChargingStation",
                "STATION-BACKOFF-001",
                "StationStatusChanged",
                "{\"stationId\":\"STATION-BACKOFF-001\"}",
                Instant.now(),
                Instant.now()
        );

        // Simulate 1 failure that just occurred right now
        event.recordFailure("Temporary broker timeout", Instant.now());
        repository.save(event);

        // Attempting immediate poll while within backoff window (500ms for retry 1)
        var pollImmediately = repository.findNextUnpublishedForUpdate();
        assertThat(pollImmediately).isEmpty();
    }
}
