package com.voltgrid.operations.messaging.event;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StationStatusChangedEventParserTests {

    private StationStatusChangedEventParser parser;

    @BeforeEach
    void setUp() {
        parser =
                new StationStatusChangedEventParser(
                        JsonMapper.builder()
                                .findAndAddModules()
                                .build()
                );
    }

    @Test
    void shouldParseStationStatusChangedEvent() {
        var eventId =
                UUID.randomUUID();

        var payload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-13T16:00:00Z"
                }
                """
                        .formatted(
                                eventId
                        );

        var event =
                parser.parse(
                        payload
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
                Instant.parse(
                        "2026-09-13T16:00:00Z"
                ),
                event.occurredAt()
        );
    }

    @Test
    void shouldRejectMalformedJson() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        parser.parse(
                                "{not-valid-json"
                        )
        );
    }

    @Test
    void shouldRejectBlankPayload() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        parser.parse(
                                " "
                        )
        );
    }

    @Test
    void shouldRejectSemanticallyInvalidEvent() {
        var payload =
                """
                {
                  "eventId": "f2550708-31fc-4d91-92fa-d58ea53111b2",
                  "stationId": "STATION-001",
                  "previousStatus": "ONLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-13T16:00:00Z"
                }
                """;

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        parser.parse(
                                payload
                        )
        );
    }
}