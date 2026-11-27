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
                "spring.kafka.listener.auto-startup=false",
                "voltgrid.security.require-auth=false"
        }
)
@Import(PostgresTestConfiguration.class)
class StationStatusCausalOrderingIntegrationTests {

    @Autowired
    private ProjectingStationStatusChangedHandler handler;

    @Autowired
    private StationStatusProjectionRepository projectionRepository;

    @Autowired
    private ProcessedEventReceiptRepository receiptRepository;

    @BeforeEach
    void clean() {
        receiptRepository.deleteAll();
        projectionRepository.deleteAll();
    }

    @Test
    void shouldPreventStaleProjectionOverwriteWhenEventsHaveEqualTimestampsButDistinctSequenceNumbers() {
        String stationId = "STATION-ORDER-001";
        Instant exactSameTimestamp = Instant.parse("2026-11-27T12:00:00.123456Z");

        UUID event1Id = UUID.randomUUID();
        UUID event2Id = UUID.randomUUID();

        // Event 1: earlier causal sequence (1)
        StationStatusChangedEvent event1 = new StationStatusChangedEvent(
                event1Id,
                stationId,
                "org-volt",
                "OFFLINE",
                "ONLINE",
                exactSameTimestamp,
                1L
        );

        // Event 2: later causal sequence (2)
        StationStatusChangedEvent event2 = new StationStatusChangedEvent(
                event2Id,
                stationId,
                "org-volt",
                "ONLINE",
                "OCCUPIED",
                exactSameTimestamp,
                2L
        );

        // Simulate out-of-order delivery: Event 2 arrives first!
        handler.handle(event2);

        var projectionAfterEvent2 = projectionRepository.findById(stationId).orElseThrow();
        assertThat(projectionAfterEvent2.getCurrentStatus()).isEqualTo("OCCUPIED");
        assertThat(projectionAfterEvent2.getLastEventId()).isEqualTo(event2Id);
        assertThat(projectionAfterEvent2.getSequenceNumber()).isEqualTo(2L);

        // Event 1 arrives late (reordered Kafka delivery or retry)
        handler.handle(event1);

        // Invariant: Projection MUST NOT be overwritten by the causally older event!
        var projectionAfterEvent1 = projectionRepository.findById(stationId).orElseThrow();
        assertThat(projectionAfterEvent1.getCurrentStatus())
                .as("Projection must retain newer causal status despite equal timestamps")
                .isEqualTo("OCCUPIED");
        assertThat(projectionAfterEvent1.getLastEventId()).isEqualTo(event2Id);
        assertThat(projectionAfterEvent1.getSequenceNumber()).isEqualTo(2L);

        // Both receipts are durably recorded
        assertThat(receiptRepository.existsById(event1Id)).isTrue();
        assertThat(receiptRepository.existsById(event2Id)).isTrue();
    }

    @Test
    void shouldUpdateProjectionWhenSequencesDeliveredInOrderWithEqualTimestamps() {
        String stationId = "STATION-ORDER-002";
        Instant exactSameTimestamp = Instant.parse("2026-11-27T12:00:00.123456Z");

        UUID event1Id = UUID.randomUUID();
        UUID event2Id = UUID.randomUUID();

        // Event 1: earlier causal sequence (1)
        StationStatusChangedEvent event1 = new StationStatusChangedEvent(
                event1Id,
                stationId,
                "org-volt",
                "OFFLINE",
                "ONLINE",
                exactSameTimestamp,
                1L
        );

        // Event 2: later causal sequence (2)
        StationStatusChangedEvent event2 = new StationStatusChangedEvent(
                event2Id,
                stationId,
                "org-volt",
                "ONLINE",
                "OCCUPIED",
                exactSameTimestamp,
                2L
        );

        // In-order delivery
        handler.handle(event1);
        var proj1 = projectionRepository.findById(stationId).orElseThrow();
        assertThat(proj1.getCurrentStatus()).isEqualTo("ONLINE");
        assertThat(proj1.getSequenceNumber()).isEqualTo(1L);

        handler.handle(event2);
        var proj2 = projectionRepository.findById(stationId).orElseThrow();
        assertThat(proj2.getCurrentStatus()).isEqualTo("OCCUPIED");
        assertThat(proj2.getSequenceNumber()).isEqualTo(2L);
        assertThat(proj2.getLastEventId()).isEqualTo(event2Id);
    }
}
