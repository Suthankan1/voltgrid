package com.voltgrid.station.messaging.event;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StationStatusChangedEventTests {

    @Test
    void shouldCreateStationStatusChangedEvent() {
        var eventId =
                UUID.randomUUID();

        var occurredAt =
                Instant.parse(
                        "2026-09-12T06:00:00Z"
                );

        var event =
                new StationStatusChangedEvent(
                        eventId,
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        occurredAt
                );

        assertEquals(
                eventId,
                event.eventId()
        );

        assertEquals(
                "STATION-001",
                event.stationId()
        );

        assertEquals(
                "OFFLINE",
                event.previousStatus()
        );

        assertEquals(
                "ONLINE",
                event.currentStatus()
        );

        assertEquals(
                occurredAt,
                event.occurredAt()
        );
    }

    @Test
    void shouldRejectBlankStationId() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new StationStatusChangedEvent(
                                UUID.randomUUID(),
                                " ",
                                "OFFLINE",
                                "ONLINE",
                                Instant.now()
                        )
        );
    }

    @Test
    void shouldRejectBlankPreviousStatus() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new StationStatusChangedEvent(
                                UUID.randomUUID(),
                                "STATION-001",
                                " ",
                                "ONLINE",
                                Instant.now()
                        )
        );
    }

    @Test
    void shouldRejectBlankCurrentStatus() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new StationStatusChangedEvent(
                                UUID.randomUUID(),
                                "STATION-001",
                                "OFFLINE",
                                " ",
                                Instant.now()
                        )
        );
    }

    @Test
    void shouldRejectUnchangedStatus() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new StationStatusChangedEvent(
                                UUID.randomUUID(),
                                "STATION-001",
                                "ONLINE",
                                "ONLINE",
                                Instant.now()
                        )
        );
    }
}