package com.voltgrid.station.messaging.outbox;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false"
        }
)
@Testcontainers
class OutboxRelayIntegrationTests {

    private static final String TOPIC =
            "voltgrid.station-status-changed.v1";

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer(
                    "postgres:18.6"
            )
                    .withDatabaseName(
                            "voltgrid_station"
                    )
                    .withUsername(
                            "voltgrid"
                    )
                    .withPassword(
                            "voltgrid_dev"
                    );

    @Container
    static final KafkaContainer KAFKA =
            new KafkaContainer(
                    "apache/kafka:4.2.1"
            );

    @DynamicPropertySource
    static void configureInfrastructure(
            DynamicPropertyRegistry registry
    ) {
        registry.add(
                "spring.datasource.url",
                POSTGRES::getJdbcUrl
        );

        registry.add(
                "spring.datasource.username",
                POSTGRES::getUsername
        );

        registry.add(
                "spring.datasource.password",
                POSTGRES::getPassword
        );

        registry.add(
                "spring.kafka.bootstrap-servers",
                KAFKA::getBootstrapServers
        );
    }

    @BeforeAll
    static void createTopic()
            throws Exception {

        var properties =
                Map.<String, Object>of(
                        AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG,
                        KAFKA.getBootstrapServers()
                );

        try (
                var adminClient =
                        AdminClient.create(
                                properties
                        )
        ) {
            adminClient
                    .createTopics(
                            List.of(
                                    new NewTopic(
                                            TOPIC,
                                            1,
                                            (short) 1
                                    )
                            )
                    )
                    .all()
                    .get();
        }
    }

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private OutboxRelayService outboxRelayService;

    @Autowired
    private JsonMapper jsonMapper;

    @BeforeEach
    void cleanDatabase() {
        outboxEventRepository.deleteAll();
    }

    @Test
    void shouldPublishOutboxEventToKafkaAndMarkItPublished()
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
                  "occurredAt": "2026-09-12T17:00:00Z"
                }
                """
                        .formatted(
                                eventId
                        );

        outboxEventRepository.saveAndFlush(
                new OutboxEventEntity(
                        eventId,
                        "ChargingStation",
                        "STATION-KAFKA-001",
                        "StationStatusChanged",
                        payload,
                        Instant.parse(
                                "2026-09-12T17:00:00Z"
                        ),
                        Instant.parse(
                                "2026-09-12T17:00:01Z"
                        )
                )
        );

        var relayed =
                outboxRelayService.relayNext();

        assertThat(
                relayed
        ).isTrue();

        var persisted =
                outboxEventRepository
                        .findById(
                                eventId
                        )
                        .orElseThrow();

        assertThat(
                persisted.getPublishedAt()
        ).isNotNull();

        try (
                var consumer =
                        createConsumer()
        ) {
            consumer.subscribe(
                    List.of(
                            TOPIC
                    )
            );

            var record =
                    awaitRecord(
                            consumer,
                            Duration.ofSeconds(10)
                    );

            assertThat(
                    record.key()
            ).isEqualTo(
                    "STATION-KAFKA-001"
            );

            assertThat(
                    record.value()
            ).isEqualTo(
                    persisted.getPayload()
            );

            assertThat(
                    jsonMapper.readTree(
                            record.value()
                    )
            ).isEqualTo(
                    jsonMapper.readTree(
                            payload
                    )
            );
        }
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
                "outbox-relay-integration-"
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

            if (!records.isEmpty()) {
                return records.iterator()
                        .next();
            }
        }

        fail(
                "Timed out waiting for Kafka record"
        );

        return null;
    }
}