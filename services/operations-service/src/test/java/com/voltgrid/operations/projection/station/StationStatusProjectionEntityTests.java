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
}
