package com.voltgrid.station.messaging.outbox;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxRelayServiceTests {

    private static final String TOPIC =
            "voltgrid.station-status-changed.v1";

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private OutboxRelayService service;

    @BeforeEach
    void setUp() {
        service =
                new OutboxRelayService(
                        outboxEventRepository,
                        kafkaTemplate,
                        TOPIC,
                        Duration.ofSeconds(5)
                );
    }

    @Test
    void shouldReturnFalseWhenNoUnpublishedEventExists() {
        when(
                outboxEventRepository
                        .findFirstByPublishedAtIsNullOrderByCreatedAtAsc()
        ).thenReturn(
                Optional.empty()
        );

        var relayed =
                service.relayNext();

        assertFalse(
                relayed
        );

        verify(
                kafkaTemplate,
                never()
        ).send(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void shouldPublishEventAndMarkItPublished() {
        var event =
                createEvent();

        when(
                outboxEventRepository
                        .findFirstByPublishedAtIsNullOrderByCreatedAtAsc()
        ).thenReturn(
                Optional.of(
                        event
                )
        );

        CompletableFuture<SendResult<String, String>>
                sendFuture =
                CompletableFuture.completedFuture(
                        null
                );

        when(
                kafkaTemplate.send(
                        TOPIC,
                        "STATION-001",
                        event.getPayload()
                )
        ).thenReturn(
                sendFuture
        );

        var relayed =
                service.relayNext();

        assertTrue(
                relayed
        );

        verify(kafkaTemplate)
                .send(
                        TOPIC,
                        "STATION-001",
                        event.getPayload()
                );

        assertNotNull(
                event.getPublishedAt()
        );

        verify(outboxEventRepository)
                .save(
                        event
                );
    }

    @Test
    void shouldLeaveEventUnpublishedWhenKafkaSendFails() {
        var event =
                createEvent();

        when(
                outboxEventRepository
                        .findFirstByPublishedAtIsNullOrderByCreatedAtAsc()
        ).thenReturn(
                Optional.of(
                        event
                )
        );

        var sendFailure =
                new CompletableFuture<
                        SendResult<String, String>
                        >();

        sendFailure.completeExceptionally(
                new IllegalStateException(
                        "Kafka unavailable"
                )
        );

        when(
                kafkaTemplate.send(
                        TOPIC,
                        "STATION-001",
                        event.getPayload()
                )
        ).thenReturn(
                sendFailure
        );

        assertThrows(
                IllegalStateException.class,
                service::relayNext
        );

        assertNull(
                event.getPublishedAt()
        );

        verify(
                outboxEventRepository,
                never()
        ).save(
                event
        );
    }

    private OutboxEventEntity createEvent() {
        return new OutboxEventEntity(
                UUID.randomUUID(),
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
                Instant.parse(
                        "2026-09-12T10:00:00Z"
                ),
                Instant.parse(
                        "2026-09-12T10:00:01Z"
                )
        );
    }
}