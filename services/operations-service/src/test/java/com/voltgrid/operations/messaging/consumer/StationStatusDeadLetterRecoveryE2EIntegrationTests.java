package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest
@Testcontainers
@Import({
        PostgresTestConfiguration.class,
        StationStatusDeadLetterRecoveryE2EIntegrationTests
                .TopicConfiguration.class
})
class StationStatusDeadLetterRecoveryE2EIntegrationTests {

    private static final String TOPIC =
            "voltgrid.station-status-changed.v1";

    private static final String DLT =
            "voltgrid.station-status-changed.v1.dlt";

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
    void shouldContinueProcessingAfterMalformedRecordIsDeadLettered()
            throws Exception {

        var partitionKey =
                "STATION-DLT-RECOVERY-001";

        var malformedPayload =
                """
                {
                  "eventId": "not-a-uuid",
                  "stationId": "STATION-DLT-RECOVERY-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-17T06:00:00Z"
                }
                """;

        var validEventId =
                UUID.randomUUID();

        var validPayload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-DLT-RECOVERY-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-17T06:01:00Z"
                }
                """
                        .formatted(
                                validEventId
                        );

        try (
                var producer =
                        createProducer()
        ) {
            producer.send(
                    new ProducerRecord<>(
                            TOPIC,
                            partitionKey,
                            malformedPayload
                    )
            ).get();

            producer.send(
                    new ProducerRecord<>(
                            TOPIC,
                            partitionKey,
                            validPayload
                    )
            ).get();
        }

        try (
                var dltConsumer =
                        createDltConsumer()
        ) {
            dltConsumer.subscribe(
                    List.of(
                            DLT
                    )
            );

            var deadLetterRecord =
                    awaitRecord(
                            dltConsumer,
                            partitionKey,
                            Duration.ofSeconds(10)
                    );

            assertThat(
                    deadLetterRecord.value()
            ).isEqualTo(
                    malformedPayload
            );
        }

        awaitProjection(
                "STATION-DLT-RECOVERY-001",
                Duration.ofSeconds(10)
        );

        var projection =
                projectionRepository
                        .findById(
                                "STATION-DLT-RECOVERY-001"
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
                validEventId
        );

        assertThat(
                projection.getStatusChangedAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-17T06:01:00Z"
                )
        );

        assertThat(
                receiptRepository.existsById(
                        validEventId
                )
        ).isTrue();

        assertThat(
                receiptRepository.count()
        ).isEqualTo(
                1
        );

        assertThat(
                projectionRepository.count()
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

    private KafkaConsumer<String, String> createDltConsumer() {
        var properties =
                new HashMap<String, Object>();

        properties.put(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG,
                KAFKA.getBootstrapServers()
        );

        properties.put(
                ConsumerConfig.GROUP_ID_CONFIG,
                "operations-dlt-recovery-test-"
                        + UUID.randomUUID()
        );

        properties.put(
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG,
                "earliest"
        );

        properties.put(
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG,
                false
        );

        properties.put(
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG,
                StringDeserializer.class
        );

        properties.put(
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG,
                StringDeserializer.class
        );

        return new KafkaConsumer<>(
                properties
        );
    }

    private org.apache.kafka.clients.consumer.ConsumerRecord<
            String,
            String
            > awaitRecord(
            KafkaConsumer<String, String> consumer,
            String expectedKey,
            Duration timeout
    ) {
        var deadline =
                System.nanoTime()
                        + timeout.toNanos();

        while (System.nanoTime() < deadline) {
            var records =
                    consumer.poll(
                            Duration.ofMillis(250)
                    );

            for (var record : records) {
                if (expectedKey.equals(
                        record.key()
                )) {
                    return record;
                }
            }
        }

        fail(
                "Timed out waiting for DLT record with key "
                        + expectedKey
        );

        return null;
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
                "Timed out waiting for station projection "
                        + stationId
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

        @Bean
        NewTopic stationStatusDeadLetterTopic() {
            return TopicBuilder
                    .name(
                            DLT
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