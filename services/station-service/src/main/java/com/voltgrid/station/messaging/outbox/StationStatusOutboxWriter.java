package com.voltgrid.station.messaging.outbox;

import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Objects;

@Component
public class StationStatusOutboxWriter {

    private static final String AGGREGATE_TYPE =
            "ChargingStation";

    private static final String EVENT_TYPE =
            "StationStatusChanged";

    private final OutboxEventRepository outboxEventRepository;
    private final JsonMapper jsonMapper;

    public StationStatusOutboxWriter(
            OutboxEventRepository outboxEventRepository,
            JsonMapper jsonMapper
    ) {
        this.outboxEventRepository =
                outboxEventRepository;

        this.jsonMapper =
                jsonMapper;
    }

    public void save(
            StationStatusChangedEvent event,
            Instant createdAt
    ) {
        Objects.requireNonNull(
                event,
                "event must not be null"
        );

        Objects.requireNonNull(
                createdAt,
                "createdAt must not be null"
        );

        var payload =
                serialize(event);

        outboxEventRepository.save(
                new OutboxEventEntity(
                        event.eventId(),
                        AGGREGATE_TYPE,
                        event.stationId(),
                        EVENT_TYPE,
                        payload,
                        event.occurredAt(),
                        createdAt
                )
        );
    }

    private String serialize(
            StationStatusChangedEvent event
    ) {
        try {
            return jsonMapper.writeValueAsString(
                    event
            );

        } catch (JacksonException exception) {
            throw new IllegalStateException(
                    "Failed to serialize station status event",
                    exception
            );
        }
    }
}