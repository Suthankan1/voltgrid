package com.voltgrid.station.messaging.outbox;

import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationStatusOutboxWriterTests {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private JsonMapper jsonMapper;

    private StationStatusOutboxWriter writer;

    @BeforeEach
    void setUp() {
        writer =
                new StationStatusOutboxWriter(
                        outboxEventRepository,
                        jsonMapper
                );
    }

    @Test
    void shouldPersistStationStatusChangedEvent()
            throws Exception {

        var eventId =
                UUID.randomUUID();

        var occurredAt =
                Instant.parse(
                        "2026-09-12T06:00:00Z"
                );

        var createdAt =
                Instant.parse(
                        "2026-09-12T06:00:01Z"
                );

        var event =
                new StationStatusChangedEvent(
                        eventId,
                        "STATION-001",
                        "OFFLINE",
                        "ONLINE",
                        occurredAt
                );

        var payload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-12T06:00:00Z"
                }
                """
                        .formatted(
                                eventId
                        );

        when(
                jsonMapper.writeValueAsString(
                        event
                )
        ).thenReturn(
                payload
        );

        writer.save(
                event,
                createdAt
        );

        var captor =
                ArgumentCaptor.forClass(
                        OutboxEventEntity.class
                );

        verify(outboxEventRepository)
                .save(
                        captor.capture()
                );

        var saved =
                captor.getValue();

        assertThat(
                saved.getId()
        ).isEqualTo(
                eventId
        );

        assertThat(
                saved.getAggregateType()
        ).isEqualTo(
                "ChargingStation"
        );

        assertThat(
                saved.getAggregateId()
        ).isEqualTo(
                "STATION-001"
        );

        assertThat(
                saved.getEventType()
        ).isEqualTo(
                "StationStatusChanged"
        );

        assertThat(
                saved.getPayload()
        ).isEqualTo(
                payload
        );

        assertThat(
                saved.getOccurredAt()
        ).isEqualTo(
                occurredAt
        );

        assertThat(
                saved.getCreatedAt()
        ).isEqualTo(
                createdAt
        );

        assertThat(
                saved.getPublishedAt()
        ).isNull();
    }
}