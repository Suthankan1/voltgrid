package com.voltgrid.station.messaging.outbox;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OutboxEventEntityTests {

    @Test
    void shouldCreateOutboxEvent() {
        var id =
                UUID.randomUUID();

        var occurredAt =
                Instant.parse(
                        "2026-09-12T06:00:00Z"
                );

        var createdAt =
                Instant.parse(
                        "2026-09-12T06:00:01Z"
                );

        var entity =
                new OutboxEventEntity(
                        id,
                        "ChargingStation",
                        "STATION-001",
                        "StationStatusChanged",
                        """
                        {
                          "stationId": "STATION-001",
                          "previousStatus": "OFFLINE",
                          "currentStatus": "ONLINE"
                        }
                        """,
                        occurredAt,
                        createdAt
                );

        assertEquals(
                id,
                entity.getId()
        );

        assertEquals(
                "ChargingStation",
                entity.getAggregateType()
        );

        assertEquals(
                "STATION-001",
                entity.getAggregateId()
        );

        assertEquals(
                "StationStatusChanged",
                entity.getEventType()
        );

        assertEquals(
                occurredAt,
                entity.getOccurredAt()
        );

        assertEquals(
                createdAt,
                entity.getCreatedAt()
        );

        assertNull(
                entity.getPublishedAt()
        );
    }

    @Test
    void shouldMarkOutboxEventPublished() {
        var entity =
                new OutboxEventEntity(
                        UUID.randomUUID(),
                        "ChargingStation",
                        "STATION-001",
                        "StationStatusChanged",
                        "{}",
                        Instant.now(),
                        Instant.now()
                );

        var publishedAt =
                Instant.parse(
                        "2026-09-12T06:05:00Z"
                );

        entity.markPublished(
                publishedAt
        );

        assertEquals(
                publishedAt,
                entity.getPublishedAt()
        );
    }

    @Test
    void shouldRejectBlankAggregateId() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new OutboxEventEntity(
                                UUID.randomUUID(),
                                "ChargingStation",
                                " ",
                                "StationStatusChanged",
                                "{}",
                                Instant.now(),
                                Instant.now()
                        )
        );
    }

    @Test
    void shouldRejectBlankPayload() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new OutboxEventEntity(
                                UUID.randomUUID(),
                                "ChargingStation",
                                "STATION-001",
                                "StationStatusChanged",
                                " ",
                                Instant.now(),
                                Instant.now()
                        )
        );
    }

    @Test
    void shouldRejectNullPublishedTimestamp() {
        var entity =
                new OutboxEventEntity(
                        UUID.randomUUID(),
                        "ChargingStation",
                        "STATION-001",
                        "StationStatusChanged",
                        "{}",
                        Instant.now(),
                        Instant.now()
                );

        assertThrows(
                NullPointerException.class,
                () ->
                        entity.markPublished(
                                null
                        )
        );
    }
}