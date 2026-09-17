package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.application.StationStatusChangedHandler;
import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
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
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest
@Testcontainers
@Import({
        PostgresTestConfiguration.class,
        StationStatusFailureE2EIntegrationTests
                .TopicConfiguration.class,
        StationStatusFailureE2EIntegrationTests
                .FailureHandlerConfiguration.class
})
class StationStatusFailureE2EIntegrationTests {

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

    @Autowired
    private RetryProbeHandler retryProbeHandler;

    @BeforeEach
    void cleanDatabase() {
        receiptRepository.deleteAll();
        projectionRepository.deleteAll();
        retryProbeHandler.reset();
    }

    @Test
    void shouldSendMalformedEventDirectlyToDeadLetterTopic()
            throws Exception {

        var malformedPayload =
                """
                {
                  "eventId": "not-a-uuid",
                  "stationId": "STATION-DLT-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-17T03:00:00Z"
                }
                """;

        try (
                var producer =
                        createProducer()
        ) {
            producer.send(
                    new ProducerRecord<>(
                            TOPIC,
                            "STATION-DLT-001",
                            malformedPayload
                    )
            ).get();
        }

        try (
                var consumer =
                        createConsumer()
        ) {
            consumer.subscribe(
                    List.of(
                            DLT
                    )
            );

            var record =
                    awaitRecord(
                            consumer,
                            "STATION-DLT-001",
                            Duration.ofSeconds(10)
                    );

            assertThat(
                    record.key()
            ).isEqualTo(
                    "STATION-DLT-001"
            );

            assertThat(
                    record.value()
            ).isEqualTo(
                    malformedPayload
            );
        }

        assertThat(
                retryProbeHandler.attempts()
        ).isZero();

        assertThat(
                receiptRepository.count()
        ).isZero();

        assertThat(
                projectionRepository.count()
        ).isZero();
    }

    @Test
    void shouldRetryProcessingFailureTwiceBeforeDeadLettering()
            throws Exception {

        var eventId =
                UUID.randomUUID();

        var payload =
                """
                {
                  "eventId": "%s",
                  "stationId": "STATION-RETRY-001",
                  "previousStatus": "OFFLINE",
                  "currentStatus": "ONLINE",
                  "occurredAt": "2026-09-17T04:30:00Z"
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
                            "STATION-RETRY-001",
                            payload
                    )
            ).get();
        }

        try (
                var consumer =
                        createConsumer()
        ) {
            consumer.subscribe(
                    List.of(
                            DLT
                    )
            );

            var record =
                    awaitRecord(
                            consumer,
                            "STATION-RETRY-001",
                            Duration.ofSeconds(10)
                    );

            assertThat(
                    record.key()
            ).isEqualTo(
                    "STATION-RETRY-001"
            );

            assertThat(
                    record.value()
            ).isEqualTo(
                    payload
            );
        }

        assertThat(
                retryProbeHandler.attempts()
        ).isEqualTo(
                3
        );

        assertThat(
                receiptRepository.count()
        ).isZero();

        assertThat(
                projectionRepository.count()
        ).isZero();
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

    private KafkaConsumer<String, String> createConsumer() {
        var properties =
                new HashMap<String, Object>();

        properties.put(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG,
                KAFKA.getBootstrapServers()
        );

        properties.put(
                ConsumerConfig.GROUP_ID_CONFIG,
                "operations-dlt-test-"
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
                "Timed out waiting for dead-letter record with key "
                        + expectedKey
        );

        return null;
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

    @TestConfiguration(proxyBeanMethods = false)
    static class FailureHandlerConfiguration {

        @Bean
        @Primary
        RetryProbeHandler retryProbeHandler() {
            return new RetryProbeHandler();
        }
    }

    static class RetryProbeHandler
            implements StationStatusChangedHandler {

        private final AtomicInteger attempts =
                new AtomicInteger();

        @Override
        public void handle(
                StationStatusChangedEvent event
        ) {
            attempts.incrementAndGet();

            throw new IllegalStateException(
                    "Synthetic retryable processing failure"
            );
        }

        int attempts() {
            return attempts.get();
        }

        void reset() {
            attempts.set(
                    0
            );
        }
    }
}