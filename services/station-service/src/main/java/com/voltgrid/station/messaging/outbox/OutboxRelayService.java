package com.voltgrid.station.messaging.outbox;

import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapGetter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class OutboxRelayService {

    private static final TextMapGetter<JsonNode>
            TRACE_CONTEXT_GETTER =
            new TextMapGetter<>() {

                @Override
                public Iterable<String> keys(
                        JsonNode carrier
                ) {
                    return List.of(
                            "traceparent",
                            "tracestate"
                    );
                }

                @Override
                public String get(
                        JsonNode carrier,
                        String key
                ) {
                    if (carrier == null) {
                        return null;
                    }

                    var value =
                            carrier.get(
                                    key
                            );

                    if (value == null
                            || !value.isString()) {

                        return null;
                    }

                    return value.stringValue();
                }
            };

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final JsonMapper jsonMapper;
    private final String stationStatusTopic;
    private final Duration publishTimeout;

    public OutboxRelayService(
            OutboxEventRepository outboxEventRepository,
            KafkaTemplate<String, String> kafkaTemplate,
            JsonMapper jsonMapper,
            @Value(
                    "${voltgrid.kafka.station-status-topic}"
            )
            String stationStatusTopic,
            @Value(
                    "${voltgrid.kafka.outbox.publish-timeout}"
            )
            Duration publishTimeout
    ) {
        this.outboxEventRepository =
                outboxEventRepository;

        this.kafkaTemplate =
                kafkaTemplate;

        this.jsonMapper =
                jsonMapper;

        this.stationStatusTopic =
                stationStatusTopic;

        this.publishTimeout =
                publishTimeout;
    }

    @Transactional
    public boolean relayNext() {
        var event =
                outboxEventRepository
                        .findNextUnpublishedForUpdate()
                        .orElse(null);

        if (event == null) {
            return false;
        }

        publish(
                event
        );

        event.markPublished(
                Instant.now()
        );

        outboxEventRepository.save(
                event
        );

        return true;
    }

    private void publish(
            OutboxEventEntity event
    ) {
        var parentContext =
                extractTraceContext(
                        event
                );

        try (var ignored =
                     parentContext.makeCurrent()) {

            kafkaTemplate
                    .send(
                            stationStatusTopic,
                            event.getAggregateId(),
                            event.getPayload()
                    )
                    .get(
                            publishTimeout.toMillis(),
                            TimeUnit.MILLISECONDS
                    );

        } catch (InterruptedException exception) {
            Thread.currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "Interrupted while publishing outbox event: "
                            + event.getId(),
                    exception
            );

        } catch (
                ExecutionException
                | TimeoutException exception
        ) {
            throw new IllegalStateException(
                    "Failed to publish outbox event: "
                            + event.getId(),
                    exception
            );
        }
    }

    private Context extractTraceContext(
            OutboxEventEntity event
    ) {
        var traceContext =
                event.getTraceContext();

        if (traceContext == null
                || traceContext.isBlank()) {

            return Context.current();
        }

        try {
            var carrier =
                    jsonMapper.readTree(
                            traceContext
                    );

            return W3CTraceContextPropagator
                    .getInstance()
                    .extract(
                            Context.current(),
                            carrier,
                            TRACE_CONTEXT_GETTER
                    );

        } catch (JacksonException exception) {
            throw new IllegalStateException(
                    "Failed to deserialize outbox trace context: "
                            + event.getId(),
                    exception
            );
        }
    }
}