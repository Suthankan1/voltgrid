package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest
@Testcontainers
@Import({
        PostgresTestConfiguration.class,
        StationStatusProjectionE2EIntegrationTests
                .TopicConfiguration.class
})
class StationStatusProjectionE2EIntegrationTests {

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
    private StationStatusProjectionRepository projectionRepository;

    @Autowired
    private ProcessedEventReceiptRepository receiptRepository;

    @BeforeEach
    void cleanDatabase() {
        receiptRepository.deleteAll();
        projectionRepository.deleteAll();
    }

    @Test
    void shouldConsumeKafkaEventAndPersistProjectionAndReceipt()
            throws Exception {

        var eventId =
                UUID.randomUUID();

        var payload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-E2E-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-17T03:30:00Z"
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
                            "STATION-E2E-001",
                            payload
                    )
            ).get();
        }

        awaitProjection(
                "STATION-E2E-001",
                Duration.ofSeconds(10)
        );

        var projection =
                projectionRepository
                        .findById(
                                "STATION-E2E-001"
                        )
                        .orElseThrow();

        assertThat(
                projection.getCurrentStatus()
        ).isEqualTo(
                "ONLINE"
        );

        assertThat(
                projection.getLastEventId()
        ).isEqualTo(
                eventId
        );

        assertThat(
                projection.getStatusChangedAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-17T03:30:00Z"
                )
        );

        var receipt =
                receiptRepository
                        .findById(
                                eventId
                        )
                        .orElseThrow();

        assertThat(
                receipt.getEventType()
        ).isEqualTo(
                "StationStatusChanged"
        );

        assertThat(
                receipt.getProcessedAt()
        ).isNotNull();

        assertThat(
                projectionRepository.count()
        ).isEqualTo(
                1
        );

        assertThat(
                receiptRepository.count()
        ).isEqualTo(
                1
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

    private void awaitProjection(
            String stationId,
            Duration timeout
    ) throws InterruptedException {

        var deadline =
                System.nanoTime()
                        + timeout.toNanos();

        while (System.nanoTime() < deadline) {
            if (projectionRepository.existsById(
                    stationId
            )) {
                return;
            }

            Thread.sleep(
                    100
            );
        }

        fail(
                "Timed out waiting for station projection"
        );
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TopicConfiguration {

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
    }
}