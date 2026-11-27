package com.voltgrid.station.persistence;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
class HistoricalStationMigrationTests {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.6");

    private static final String SNAPSHOT = """
            SELECT jsonb_build_array(
              (SELECT jsonb_agg(to_jsonb(s) - 'organization_id' - 'site_id' - 'connection_generation' - 'status_sequence_number' ORDER BY id) FROM charging_stations s),
              (SELECT jsonb_agg(to_jsonb(c) ORDER BY station_id) FROM station_connectors c),
              (SELECT jsonb_agg(to_jsonb(t) ORDER BY station_id) FROM charging_transactions t),
              (SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM transaction_meter_samples m),
              (SELECT jsonb_agg(to_jsonb(r) ORDER BY station_id) FROM transaction_event_receipts r),
              (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM outbox_events o)
            )::text
            """;

    private static final String MIGRATION_ROLE = "station_migrator";
    private static final String MIGRATION_PASSWORD = java.util.UUID.randomUUID().toString();

    private JdbcTemplate jdbc;

    @BeforeAll
    static void createMigrationRole() {
        JdbcTemplate admin = administrator();
        admin.execute("CREATE ROLE station_migrator LOGIN PASSWORD '" + MIGRATION_PASSWORD + "'");
        admin.execute("ALTER SCHEMA public OWNER TO station_migrator");
    }

    private static JdbcTemplate administrator() {
        return new JdbcTemplate(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    }

    @BeforeEach
    void reset() throws IOException {
        jdbc = administrator();
        maintenance("remove");
        flyway("latest").clean();
    }

    @Test
    void freshInstallValidates() {
        flyway("latest").migrate();
        flyway("latest").validate();
        assertThat(flyway("latest").info().current().getVersion().getVersion()).isEqualTo("20");
    }

    @Test
    void migratedAuditTableRejectsUpdateDeleteAndTruncate() {
        flyway("latest").migrate();
        jdbc.update("""
                INSERT INTO administrative_audit_events (id, event_type, actor_id, resource_type, resource_id, action)
                VALUES ('event-1', 'TEST_EVENT', 'test-actor', 'STATION', 'test-station', 'CREATE')
                """);

        for (String statement : List.of(
                "UPDATE administrative_audit_events SET outcome = 'REWRITTEN'",
                "DELETE FROM administrative_audit_events",
                "TRUNCATE administrative_audit_events")) {
            assertThatThrownBy(() -> jdbc.execute(statement))
                    .hasMessageContaining("Administrative audit events are append-only");
        }
        assertThat(jdbc.queryForList("SELECT outcome FROM administrative_audit_events", String.class))
                .containsExactly("SUCCESS");
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 59, 60, 128, 255})
    void upgradesFromV14WithHistoricalData(int length) throws IOException {
        flyway("14").migrate();
        seed(length);
        upgradeAndCheck();
    }

    @Test
    void recoversFromRolledBackV15AndPreservesMixedIdentifierLengths() throws IOException {
        flyway("14").migrate();
        for (int length : List.of(1, 59, 60, 128, 255)) {
            seed(length);
        }
        String before = jdbc.queryForObject(SNAPSHOT, String.class);

        assertThatThrownBy(() -> flyway("latest").migrate())
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("character varying(64)");
        assertThat(jdbc.queryForObject(SNAPSHOT, String.class)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT to_regclass('public.station_credentials')", String.class)).isNull();
        assertThat(flyway("latest").info().current().getVersion().getVersion()).isEqualTo("14");

        upgradeAndCheck();
    }

    @ParameterizedTest
    @ValueSource(strings = {"15", "18"})
    void acceptsDatabasesAlreadyMigratedThroughV15OrV18(String version) throws IOException {
        flyway("14").migrate();
        seed(59);
        flyway(version).migrate();
        upgradeAndCheck();
    }

    private void upgradeAndCheck() throws IOException {
        String before = jdbc.queryForObject(SNAPSHOT, String.class);
        List<String> history = jdbc.queryForList("""
                SELECT to_jsonb(h)::text FROM flyway_schema_history h ORDER BY installed_rank
                """, String.class);

        maintenance("prepare");
        maintenance("prepare");
        flyway("latest").migrate();
        maintenance("remove");
        maintenance("remove");
        maintenance("prepare");
        assertThat(flyway("latest").migrate().migrationsExecuted).isZero();
        flyway("latest").validate();

        assertThat(jdbc.queryForObject(SNAPSHOT, String.class)).isEqualTo(before);
        assertThat(jdbc.queryForList("""
                SELECT to_jsonb(h)::text FROM flyway_schema_history h ORDER BY installed_rank
                """, String.class)).startsWith(history.toArray(String[]::new));
        assertThat(jdbc.queryForList("""
                SELECT id FROM charging_stations WHERE organization_id IS NOT NULL OR site_id IS NOT NULL
                """)).isEmpty();
        assertThat(jdbc.queryForList("SELECT id FROM station_credentials")).isEmpty();
        assertThat(jdbc.queryForList("""
                SELECT evtname FROM pg_event_trigger WHERE evtname = 'voltgrid_widen_v15_credential_id'
                """)).isEmpty();
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO station_credentials (id, station_id, password_hash)
                VALUES ('orphan', 'missing-station', 'synthetic-test')
                """)).hasMessageContaining("foreign key constraint");
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO charging_stations (id, name, status)
                SELECT id, name, status FROM charging_stations LIMIT 1
                """)).hasMessageContaining("duplicate key value");
    }

    private void seed(int length) {
        String station = "s".repeat(length);
        String transaction = "t".repeat(255);
        jdbc.update("INSERT INTO charging_stations (id, name, status) VALUES (?, 'Legacy', 'AVAILABLE')", station);
        jdbc.update("""
                INSERT INTO station_connectors VALUES (?, 1, 1, 'AVAILABLE', '2024-01-01T00:00:00Z')
                """, station);
        jdbc.update("""
                INSERT INTO charging_transactions
                (station_id, transaction_id, evse_id, connector_id, status, started_at, last_sequence_number)
                VALUES (?, ?, 1, 1, 'ACTIVE', '2024-01-01T00:00:00Z', 1)
                """, station, transaction);
        jdbc.update("INSERT INTO transaction_event_receipts VALUES (?, ?, 1, 'STARTED')", station, transaction);
        jdbc.update("""
                INSERT INTO transaction_meter_samples (station_id, transaction_id, sequence_number, sampled_at, value)
                VALUES (?, ?, 1, '2024-01-01T00:00:00Z', 4.25)
                """, station, transaction);
        jdbc.update("""
                INSERT INTO outbox_events
                (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, created_at, published_at)
                VALUES (gen_random_uuid(), 'STATION', ?, 'Historical', '{"state":"AVAILABLE"}',
                  '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', '2024-01-01T00:00:01Z')
                """, station);
    }

    private void maintenance(String action) throws IOException {
        jdbc.execute(Files.readString(Path.of("maintenance", action + "-pre-v15-upgrade.sql")));
    }

    private Flyway flyway(String target) {
        return Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), MIGRATION_ROLE, MIGRATION_PASSWORD)
                .target(target)
                .cleanDisabled(false)
                .load();
    }
}
