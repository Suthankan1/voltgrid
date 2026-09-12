package com.voltgrid.station.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class StationConnectivityOutboxIntegrationTests {

    private static final String COMMIT_STATION_ID =
            "STATION-OUTBOX-COMMIT";

    private static final String ROLLBACK_STATION_ID =
            "STATION-OUTBOX-ROLLBACK";

    private static final String ROLLBACK_CONSTRAINT =
            "chk_test_reject_rollback_station";

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

    @DynamicPropertySource
    static void configurePostgres(
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
    }

    @Autowired
    private StationConnectivityService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute(
                """
                ALTER TABLE outbox_events
                DROP CONSTRAINT IF EXISTS
                chk_test_reject_rollback_station
                """
        );

        jdbcTemplate.update(
                """
                DELETE FROM outbox_events
                WHERE aggregate_id IN (?, ?)
                """,
                COMMIT_STATION_ID,
                ROLLBACK_STATION_ID
        );

        jdbcTemplate.update(
                """
                DELETE FROM charging_stations
                WHERE id IN (?, ?)
                """,
                COMMIT_STATION_ID,
                ROLLBACK_STATION_ID
        );
    }

    @Test
    void shouldCommitStationStatusAndOutboxEventTogether() {
        var seenAt =
                Instant.parse(
                        "2026-09-12T08:00:00Z"
                );

        insertOfflineStation(
                COMMIT_STATION_ID,
                "Commit Test Station"
        );

        service.markOnline(
                COMMIT_STATION_ID,
                seenAt
        );

        var stationStatus =
                jdbcTemplate.queryForObject(
                        """
                        SELECT status
                        FROM charging_stations
                        WHERE id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                stationStatus
        ).isEqualTo(
                "ONLINE"
        );

        var lastSeenAt =
                jdbcTemplate.queryForObject(
                        """
                        SELECT last_seen_at
                        FROM charging_stations
                        WHERE id = ?
                        """,
                        OffsetDateTime.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                lastSeenAt
        ).isNotNull();

        assertThat(
                lastSeenAt.toInstant()
        ).isEqualTo(
                seenAt
        );

        var outboxCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        Long.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                outboxCount
        ).isEqualTo(
                1L
        );

        var eventId =
                jdbcTemplate.queryForObject(
                        """
                        SELECT id
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        UUID.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                eventId
        ).isNotNull();

        var aggregateType =
                jdbcTemplate.queryForObject(
                        """
                        SELECT aggregate_type
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                aggregateType
        ).isEqualTo(
                "ChargingStation"
        );

        var eventType =
                jdbcTemplate.queryForObject(
                        """
                        SELECT event_type
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                eventType
        ).isEqualTo(
                "StationStatusChanged"
        );

        var payloadStationId =
                jdbcTemplate.queryForObject(
                        """
                        SELECT payload ->> 'stationId'
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                payloadStationId
        ).isEqualTo(
                COMMIT_STATION_ID
        );

        var previousStatus =
                jdbcTemplate.queryForObject(
                        """
                        SELECT payload ->> 'previousStatus'
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                previousStatus
        ).isEqualTo(
                "OFFLINE"
        );

        var currentStatus =
                jdbcTemplate.queryForObject(
                        """
                        SELECT payload ->> 'currentStatus'
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        String.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                currentStatus
        ).isEqualTo(
                "ONLINE"
        );

        var published =
                jdbcTemplate.queryForObject(
                        """
                        SELECT published_at IS NOT NULL
                        FROM outbox_events
                        WHERE aggregate_id = ?
                        """,
                        Boolean.class,
                        COMMIT_STATION_ID
                );

        assertThat(
                published
        ).isFalse();
    }

    @Test
    void shouldRollbackStationUpdateWhenOutboxInsertFails() {
        var seenAt =
                Instant.parse(
                        "2026-09-12T08:05:00Z"
                );

        insertOfflineStation(
                ROLLBACK_STATION_ID,
                "Rollback Test Station"
        );

        jdbcTemplate.execute(
                """
                ALTER TABLE outbox_events
                ADD CONSTRAINT chk_test_reject_rollback_station
                CHECK (
                    aggregate_id <> 'STATION-OUTBOX-ROLLBACK'
                )
                """
        );

        try {
            assertThatThrownBy(
                    () ->
                            service.markOnline(
                                    ROLLBACK_STATION_ID,
                                    seenAt
                            )
            ).isInstanceOf(
                    RuntimeException.class
            );

            var stationStatus =
                    jdbcTemplate.queryForObject(
                            """
                            SELECT status
                            FROM charging_stations
                            WHERE id = ?
                            """,
                            String.class,
                            ROLLBACK_STATION_ID
                    );

            assertThat(
                    stationStatus
            ).isEqualTo(
                    "OFFLINE"
            );

            var lastSeenAt =
                    jdbcTemplate.queryForObject(
                            """
                            SELECT last_seen_at
                            FROM charging_stations
                            WHERE id = ?
                            """,
                            OffsetDateTime.class,
                            ROLLBACK_STATION_ID
                    );

            assertThat(
                    lastSeenAt
            ).isNull();

            var outboxCount =
                    jdbcTemplate.queryForObject(
                            """
                            SELECT COUNT(*)
                            FROM outbox_events
                            WHERE aggregate_id = ?
                            """,
                            Long.class,
                            ROLLBACK_STATION_ID
                    );

            assertThat(
                    outboxCount
            ).isZero();

        } finally {
            jdbcTemplate.execute(
                    """
                    ALTER TABLE outbox_events
                    DROP CONSTRAINT IF EXISTS
                    chk_test_reject_rollback_station
                    """
            );
        }
    }

    private void insertOfflineStation(
            String stationId,
            String name
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO charging_stations (
                    id,
                    name,
                    status,
                    last_seen_at
                )
                VALUES (
                    ?,
                    ?,
                    'OFFLINE',
                    NULL
                )
                """,
                stationId,
                name
        );
    }
}