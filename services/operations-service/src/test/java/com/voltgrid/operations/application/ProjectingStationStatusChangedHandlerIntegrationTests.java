package com.voltgrid.operations.application;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
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
class ProjectingStationStatusChangedHandlerIntegrationTests {

    @Autowired
    private ProjectingStationStatusChangedHandler handler;

    @Autowired
    private StationStatusProjectionRepository repository;

    @Autowired
    private ProcessedEventReceiptRepository receiptRepository;

    @BeforeEach
    void cleanDatabase() {
        receiptRepository.deleteAll();
        repository.deleteAll();
    }

    @Test
    void shouldCreateProjectionForFirstStationEvent() {
        var eventId =
                UUID.randomUUID();

        handler.handle(
                new StationStatusChangedEvent(
                        eventId,
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        Instant.parse(
                                "2026-09-14T03:00:00Z"
                        )
                )
        );

        var projection =
                repository
                        .findById(
                                "STATION-001"
                        )
                        .orElseThrow();

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
                Instant.parse(
                        "2026-09-14T03:00:00Z"
                )
        );

        assertThat(
                projection.getUpdatedAt()
        ).isNotNull();

        var receipt =
                receiptRepository
                        .findById(
                                eventId
                        )
                        .orElseThrow();

        assertThat(
                receipt.getEventType()
        ).isEqualTo(
                "StationStatusChanged"
        );

        assertThat(
                receipt.getProcessedAt()
        ).isNotNull();
    }

    @Test
    void shouldUpdateProjectionWhenNewerEventArrives() {
        handler.handle(
                new StationStatusChangedEvent(
                        UUID.randomUUID(),
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        Instant.parse(
                                "2026-09-14T03:00:00Z"
                        )
                )
        );

        var newerEventId =
                UUID.randomUUID();

        handler.handle(
                new StationStatusChangedEvent(
                        newerEventId,
                        "STATION-001",
                        "ONLINE",
                        "UNAVAILABLE",
                        Instant.parse(
                                "2026-09-14T03:05:00Z"
                        )
                )
        );

        var projection =
                repository
                        .findById(
                                "STATION-001"
                        )
                        .orElseThrow();

        assertThat(
                projection.getCurrentStatus()
        ).isEqualTo(
                "UNAVAILABLE"
        );

        assertThat(
                projection.getLastEventId()
        ).isEqualTo(
                newerEventId
        );

        assertThat(
                projection.getStatusChangedAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-14T03:05:00Z"
                )
        );

        assertThat(
                repository.count()
        ).isEqualTo(
                1
        );

        assertThat(
                receiptRepository.count()
        ).isEqualTo(
                2
        );
    }

    @Test
    void shouldIgnoreOlderEvent() {
        var newestEventId =
                UUID.randomUUID();

        handler.handle(
                new StationStatusChangedEvent(
                        newestEventId,
                        "STATION-001",
                        "ONLINE",
                        "UNAVAILABLE",
                        Instant.parse(
                                "2026-09-14T03:10:00Z"
                        )
                )
        );

        handler.handle(
                new StationStatusChangedEvent(
                        UUID.randomUUID(),
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        Instant.parse(
                                "2026-09-14T03:05:00Z"
                        )
                )
        );

        var projection =
                repository
                        .findById(
                                "STATION-001"
                        )
                        .orElseThrow();

        assertThat(
                projection.getCurrentStatus()
        ).isEqualTo(
                "UNAVAILABLE"
        );

        assertThat(
                projection.getLastEventId()
        ).isEqualTo(
                newestEventId
        );

        assertThat(
                projection.getStatusChangedAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-14T03:10:00Z"
                )
        );

        assertThat(
                receiptRepository.count()
        ).isEqualTo(
                2
        );
    }

    @Test
    void shouldIgnoreImmediateDuplicateEvent() {
        var eventId =
                UUID.randomUUID();

        var event =
                new StationStatusChangedEvent(
                        eventId,
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        Instant.parse(
                                "2026-09-14T03:00:00Z"
                        )
                );

        handler.handle(
                event
        );

        handler.handle(
                event
        );

        var projection =
                repository
                        .findById(
                                "STATION-001"
                        )
                        .orElseThrow();

        assertThat(
                repository.count()
        ).isEqualTo(
                1
        );

        assertThat(
                receiptRepository.count()
        ).isEqualTo(
                1
        );

        assertThat(
                projection.getLastEventId()
        ).isEqualTo(
                eventId
        );

        assertThat(
                projection.getCurrentStatus()
        ).isEqualTo(
                "ONLINE"
        );
    }
}