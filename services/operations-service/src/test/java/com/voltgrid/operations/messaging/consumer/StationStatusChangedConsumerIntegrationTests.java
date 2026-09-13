package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.application.StationStatusChangedHandler;
import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.config.TopicBuilder;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Testcontainers
@Import(
        StationStatusChangedConsumerIntegrationTests
                .TestHandlerConfiguration.class
)
class StationStatusChangedConsumerIntegrationTests {

    private static final String TOPIC =
            "voltgrid.station-status-changed.v1";

    @Container
    static final KafkaContainer KAFKA =
            new KafkaContainer(
                    "apache/kafka:4.2.1"
            );

    @DynamicPropertySource
    static void configureKafka(
            DynamicPropertyRegistry registry
    ) {
        registry.add(
                "spring.kafka.bootstrap-servers",
                KAFKA::getBootstrapServers
        );
    }

    @Autowired
    private RecordingStationStatusChangedHandler handler;

    @Test
    void shouldConsumeAndParseStationStatusChangedEvent()
            throws Exception {

        var eventId =
                UUID.randomUUID();

        var payload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-KAFKA-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-13T16:00:00Z"
                }
                """
                        .formatted(
                                eventId
                        );

        try (
                var producer =
                        createProducer()
        ) {
            producer.send(
                    new ProducerRecord<>(
                            TOPIC,
                            "STATION-KAFKA-001",
                            payload
                    )
            ).get();
        }

        assertTrue(
                handler.await(
                        Duration.ofSeconds(10)
                ),
                "Operations Service did not consume the Kafka event"
        );

        var event =
                handler.receivedEvent();

        assertThat(
                event
        ).isNotNull();

        assertThat(
                event.eventId()
        ).isEqualTo(
                eventId
        );

        assertThat(
                event.stationId()
        ).isEqualTo(
                "STATION-KAFKA-001"
        );

        assertThat(
                event.previousStatus()
        ).isEqualTo(
                "OFFLINE"
        );

        assertThat(
                event.currentStatus()
        ).isEqualTo(
                "ONLINE"
        );

        assertThat(
                event.occurredAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-13T16:00:00Z"
                )
        );
    }

    private KafkaProducer<String, String> createProducer() {
        var properties =
                new HashMap<String, Object>();

        properties.put(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,
                KAFKA.getBootstrapServers()
        );

        properties.put(
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,
                StringSerializer.class
        );

        properties.put(
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
                StringSerializer.class
        );

        properties.put(
                ProducerConfig.ACKS_CONFIG,
                "all"
        );

        return new KafkaProducer<>(
                properties
        );
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestHandlerConfiguration {

        @Bean
        NewTopic stationStatusTopic() {
            return TopicBuilder
                    .name(
                            TOPIC
                    )
                    .partitions(
                            1
                    )
                    .replicas(
                            1
                    )
                    .build();
        }

        @Bean
        @Primary
        RecordingStationStatusChangedHandler
        recordingStationStatusChangedHandler() {
            return new RecordingStationStatusChangedHandler();
        }
    }

    static final class RecordingStationStatusChangedHandler
            implements StationStatusChangedHandler {

        private final CountDownLatch latch =
                new CountDownLatch(
                        1
                );

        private final AtomicReference<
                StationStatusChangedEvent
                > receivedEvent =
                new AtomicReference<>();

        @Override
        public void handle(
                StationStatusChangedEvent event
        ) {
            receivedEvent.set(
                    event
            );

            latch.countDown();
        }

        boolean await(
                Duration timeout
        ) throws InterruptedException {

            return latch.await(
                    timeout.toMillis(),
                    TimeUnit.MILLISECONDS
            );
        }

        StationStatusChangedEvent receivedEvent() {
            return receivedEvent.get();
        }
    }
}