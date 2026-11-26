package com.voltgrid.operations;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HistoricalProjectionMigrationTests {

    @Test
    void preservesHistoricalProjectionsAndReceiptsWhileQuarantiningDefaultOwnership() {
        try (var postgres = new PostgreSQLContainer("postgres:18.6")) {
            postgres.start();
            var jdbc = new JdbcTemplate(new DriverManagerDataSource(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
            flyway(postgres, "3").migrate();

            String historicalStation = "s".repeat(128);
            String historicalEvent = "74ec6e56-ca2e-4056-8b7f-928ba6a72510";
            insertProjection(jdbc, historicalStation, historicalEvent);
            flyway(postgres, "4").migrate();

            String ownedStation = "t".repeat(255);
            insertProjection(jdbc, ownedStation, "0913acde-c0b7-4277-b475-511ac51d2153");
            jdbc.update("UPDATE station_status_projections SET organization_id = 'organization-b' WHERE station_id = ?",
                    ownedStation);
            List<String> projections = projections(jdbc);
            List<String> receipts = receipts(jdbc);

            var current = flyway(postgres, "latest");
            current.migrate();
            current.validate();
            assertThat(current.migrate().migrationsExecuted).isZero();

            assertThat(projections(jdbc)).isEqualTo(projections);
            assertThat(receipts(jdbc)).isEqualTo(receipts);
            assertThat(jdbc.queryForObject("""
                    SELECT organization_id FROM station_status_projections WHERE station_id = ?
                    """, String.class, historicalStation)).isNull();
            assertThat(jdbc.queryForList("""
                    SELECT station_id FROM station_status_projections WHERE organization_id = 'organization-b'
                    """, String.class)).containsExactly(ownedStation);
        }
    }

    private static void insertProjection(JdbcTemplate jdbc, String station, String event) {
        jdbc.update("""
                INSERT INTO station_status_projections
                  (station_id, current_status, last_event_id, status_changed_at, updated_at)
                VALUES (?, 'ONLINE', CAST(? AS uuid), '2024-01-01T00:00:00Z', '2024-01-01T00:00:01Z')
                """, station, event);
        jdbc.update("""
                INSERT INTO processed_event_receipts (event_id, event_type, processed_at)
                VALUES (CAST(? AS uuid), 'StationStatusChanged', '2024-01-01T00:00:01Z')
                """, event);
    }

    private static List<String> projections(JdbcTemplate jdbc) {
        return jdbc.queryForList("""
                SELECT (to_jsonb(p) - 'organization_id')::text
                FROM station_status_projections p ORDER BY station_id
                """, String.class);
    }

    private static List<String> receipts(JdbcTemplate jdbc) {
        return jdbc.queryForList("""
                SELECT to_jsonb(r)::text FROM processed_event_receipts r ORDER BY event_id
                """, String.class);
    }

    private static Flyway flyway(PostgreSQLContainer postgres, String target) {
        return Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target(target)
                .load();
    }
}
