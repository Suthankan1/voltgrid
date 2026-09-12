package com.voltgrid.station.messaging.outbox;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class OutboxRelayService {

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final String stationStatusTopic;
    private final Duration publishTimeout;

    public OutboxRelayService(
            OutboxEventRepository outboxEventRepository,
            KafkaTemplate<String, String> kafkaTemplate,
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

        this.stationStatusTopic =
                stationStatusTopic;

        this.publishTimeout =
                publishTimeout;
    }

    @Transactional
    public boolean relayNext() {
        var event =
                outboxEventRepository
                        .findFirstByPublishedAtIsNullOrderByCreatedAtAsc()
                        .orElse(null);

        if (event == null) {
            return false;
        }

        publish(event);

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
        try {
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
}