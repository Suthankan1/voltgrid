package com.voltgrid.station.messaging.outbox;

import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapSetter;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Component
public class StationStatusOutboxWriter {

    private static final String AGGREGATE_TYPE =
            "ChargingStation";

    private static final String EVENT_TYPE =
            "StationStatusChanged";

    private static final TextMapSetter<Map<String, String>>
            TRACE_CONTEXT_SETTER =
            (carrier, key, value) ->
                    carrier.put(
                            key,
                            value
                    );

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
                serializeEvent(
                        event
                );

        var traceContext =
                captureTraceContext();

        outboxEventRepository.save(
                new OutboxEventEntity(
                        event.eventId(),
                        AGGREGATE_TYPE,
                        event.stationId(),
                        EVENT_TYPE,
                        payload,
                        event.occurredAt(),
                        createdAt,
                        traceContext
                )
        );
    }

    private String serializeEvent(
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

    private String captureTraceContext() {
        var carrier =
                new LinkedHashMap<String, String>();

        W3CTraceContextPropagator
                .getInstance()
                .inject(
                        Context.current(),
                        carrier,
                        TRACE_CONTEXT_SETTER
                );

        if (carrier.isEmpty()) {
            return null;
        }

        try {
            return jsonMapper.writeValueAsString(
                    carrier
            );

        } catch (JacksonException exception) {
            throw new IllegalStateException(
                    "Failed to serialize outbox trace context",
                    exception
            );
        }
    }
}