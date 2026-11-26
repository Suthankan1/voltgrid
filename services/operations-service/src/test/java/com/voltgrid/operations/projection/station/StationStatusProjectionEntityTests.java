package com.voltgrid.operations.projection.station;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StationStatusProjectionEntityTests {

    @Test
    void shouldAcceptEqualTimestampWithDistinctEventId() {
        var timestamp = Instant.parse("2026-09-13T17:00:00Z");
        var initialEventId = UUID.randomUUID();
        var nextEventId = UUID.randomUUID();

        var entity = new StationStatusProjectionEntity(
                "STATION-001",
                "ONLINE",
                initialEventId,
                timestamp,
                timestamp
        );

        boolean applied = entity.apply(
                nextEventId,
                "OFFLINE",
                timestamp, // Exact same millisecond
                timestamp.plusMillis(10)
        );

        assertThat(applied).isTrue();
        assertThat(entity.getCurrentStatus()).isEqualTo("OFFLINE");
        assertThat(entity.getLastEventId()).isEqualTo(nextEventId);
    }

    @Test
    void shouldRejectStaleOlderTimestamp() {
        var timestamp = Instant.parse("2026-09-13T17:00:00Z");
        var initialEventId = UUID.randomUUID();

        var entity = new StationStatusProjectionEntity(
                "STATION-001",
                "ONLINE",
                initialEventId,
                timestamp,
                timestamp
        );

        boolean applied = entity.apply(
                UUID.randomUUID(),
                "OFFLINE",
                timestamp.minusSeconds(10), // Older timestamp
                timestamp
        );

        assertThat(applied).isFalse();
        assertThat(entity.getCurrentStatus()).isEqualTo("ONLINE");
    }

    @Test
    void shouldRejectDuplicateEventId() {
        var timestamp = Instant.parse("2026-09-13T17:00:00Z");
        var eventId = UUID.randomUUID();

        var entity = new StationStatusProjectionEntity(
                "STATION-001",
                "ONLINE",
                eventId,
                timestamp,
                timestamp
        );

        boolean applied = entity.apply(
                eventId, // Duplicate event
                "OFFLINE",
                timestamp.plusSeconds(10),
                timestamp.plusSeconds(10)
        );

        assertThat(applied).isFalse();
        assertThat(entity.getCurrentStatus()).isEqualTo("ONLINE");
    }

    @Test
    void shouldDemonstrateEqualTimestampArrivalOrderSensitivity() {
        // Documents BUG-010 distributed limitation:
        // When two events have equal timestamps (same millisecond), the projection state
        // depends entirely on delivery order (last-write-wins) rather than causal event order.
        var equalTimestamp = Instant.parse("2026-09-13T17:00:00Z");
        var eventIdA = UUID.randomUUID();
        var eventIdB = UUID.randomUUID();

        // Scenario 1: Event A (ONLINE) then Event B (OFFLINE)
        var entityScenario1 = new StationStatusProjectionEntity(
                "STATION-001",
                "ONLINE",
                eventIdA,
                equalTimestamp,
                equalTimestamp
        );
        entityScenario1.apply(eventIdB, "OFFLINE", equalTimestamp, equalTimestamp.plusMillis(1));
        assertThat(entityScenario1.getCurrentStatus()).isEqualTo("OFFLINE");

        // Scenario 2: Reversed delivery order: Event B (OFFLINE) then Event A (ONLINE)
        var entityScenario2 = new StationStatusProjectionEntity(
                "STATION-001",
                "OFFLINE",
                eventIdB,
                equalTimestamp,
                equalTimestamp
        );
        entityScenario2.apply(eventIdA, "ONLINE", equalTimestamp, equalTimestamp.plusMillis(1));
        assertThat(entityScenario2.getCurrentStatus()).isEqualTo("ONLINE");

        // Confirms that equal timestamps cannot guarantee causal determinism without aggregate versioning (VG-204)
    }
}
