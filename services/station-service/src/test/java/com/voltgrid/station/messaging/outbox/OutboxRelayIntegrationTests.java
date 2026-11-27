package com.voltgrid.station.messaging.outbox;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.security.require-auth=false"
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

    @Autowired
    private JdbcTemplate jdbcTemplate;

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

            var record = awaitRecords(consumer, eventId, 1).getFirst();

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

    @Test
    void shouldRedeliverTheSameEventAfterAcknowledgementAndDatabaseRollback() {
        var eventId = UUID.randomUUID();
        var now = Instant.now();
        var event = new OutboxEventEntity(
                eventId, "ChargingStation", "STATION-RETRY", "StationStatusChanged",
                """
                {"eventId": "%s", "stationId": "STATION-RETRY"}
                """.formatted(eventId), now, now
        );
        outboxEventRepository.saveAndFlush(event);

        jdbcTemplate.execute("""
                CREATE FUNCTION fixture_reject_outbox_publish() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'fixture outbox commit failure';
                END;
                $$
                """);
        try (var consumer = createConsumer()) {
            jdbcTemplate.execute("""
                    CREATE TRIGGER fixture_reject_outbox_publish
                    BEFORE UPDATE OF published_at ON outbox_events
                    FOR EACH ROW WHEN (NEW.published_at IS NOT NULL)
                    EXECUTE FUNCTION fixture_reject_outbox_publish()
                    """);
            try {
                assertThatThrownBy(outboxRelayService::relayNext)
                        .hasStackTraceContaining("fixture outbox commit failure");
                var retained = outboxEventRepository.findById(eventId).orElseThrow();
                assertThat(retained.getPublishedAt()).isNull();
                assertThat(retained.getRetryCount()).isZero();
                assertThat(retained.getLastAttemptedAt()).isNull();
            } finally {
                jdbcTemplate.execute("DROP TRIGGER fixture_reject_outbox_publish ON outbox_events");
            }

            assertThat(outboxRelayService.relayNext()).isTrue();
            assertThat(outboxEventRepository.findById(eventId).orElseThrow().getPublishedAt()).isNotNull();
            consumer.subscribe(List.of(TOPIC));
            var deliveries = awaitRecords(consumer, eventId, 2);
            assertThat(deliveries).extracting(ConsumerRecord::key).containsExactly("STATION-RETRY", "STATION-RETRY");
            assertThat(deliveries.get(0).value()).isEqualTo(deliveries.get(1).value());
            assertThat(deliveries.get(0).offset()).isLessThan(deliveries.get(1).offset());
        } finally {
            jdbcTemplate.execute("DROP FUNCTION fixture_reject_outbox_publish()");
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

    private List<ConsumerRecord<String, String>> awaitRecords(
            KafkaConsumer<String, String> consumer,
            UUID eventId,
            int count
    ) {
        var deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        var matching = new ArrayList<ConsumerRecord<String, String>>();
        while (matching.size() < count && System.nanoTime() < deadline) {
            for (var record : consumer.poll(Duration.ofMillis(250))) {
                if (eventId.toString().equals(jsonMapper.readTree(record.value()).path("eventId").asText())) {
                    matching.add(record);
                }
            }
        }
        assertThat(matching).hasSize(count);
        return matching;
    }
}
