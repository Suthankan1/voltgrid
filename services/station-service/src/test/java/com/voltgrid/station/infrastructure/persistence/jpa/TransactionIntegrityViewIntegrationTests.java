package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.support.PostgresTestConfiguration;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class TransactionIntegrityViewIntegrationTests {

    private static final String STATION_ID =
            "INTEGRITY-STATION";

    private static final Instant STARTED_AT =
            Instant.parse(
                    "2026-09-21T00:00:00Z"
            );

    private static final Instant ENDED_AT =
            Instant.parse(
                    "2026-09-21T00:30:00Z"
            );

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldDeriveIntegrityStatusesFromReceiptHistory() {
        insertStation();

        insertTransaction(
                "TX-COMPLETE",
                "ENDED",
                3
        );

        insertReceipt(
                "TX-COMPLETE",
                0,
                "STARTED"
        );

        insertReceipt(
                "TX-COMPLETE",
                1,
                "UPDATED"
        );

        insertReceipt(
                "TX-COMPLETE",
                2,
                "UPDATED"
        );

        insertReceipt(
                "TX-COMPLETE",
                3,
                "ENDED"
        );

        insertTransaction(
                "TX-INCOMPLETE",
                "ENDED",
                4
        );

        insertReceipt(
                "TX-INCOMPLETE",
                0,
                "STARTED"
        );

        insertReceipt(
                "TX-INCOMPLETE",
                1,
                "UPDATED"
        );

        insertReceipt(
                "TX-INCOMPLETE",
                3,
                "UPDATED"
        );

        insertReceipt(
                "TX-INCOMPLETE",
                4,
                "ENDED"
        );

        insertTransaction(
                "TX-IN-PROGRESS",
                "ACTIVE",
                3
        );

        insertReceipt(
                "TX-IN-PROGRESS",
                0,
                "STARTED"
        );

        insertReceipt(
                "TX-IN-PROGRESS",
                1,
                "UPDATED"
        );

        insertReceipt(
                "TX-IN-PROGRESS",
                3,
                "UPDATED"
        );

        insertTransaction(
                "TX-UNKNOWN-NO-HISTORY",
                "ENDED",
                3
        );

        insertTransaction(
                "TX-UNKNOWN-NO-START",
                "ENDED",
                3
        );

        insertReceipt(
                "TX-UNKNOWN-NO-START",
                1,
                "UPDATED"
        );

        insertReceipt(
                "TX-UNKNOWN-NO-START",
                2,
                "UPDATED"
        );

        insertReceipt(
                "TX-UNKNOWN-NO-START",
                3,
                "ENDED"
        );

        assertIntegrity(
                "TX-COMPLETE",
                "COMPLETE"
        );

        assertIntegrity(
                "TX-INCOMPLETE",
                "INCOMPLETE"
        );

        assertIntegrity(
                "TX-IN-PROGRESS",
                "IN_PROGRESS"
        );

        assertIntegrity(
                "TX-UNKNOWN-NO-HISTORY",
                "UNKNOWN"
        );

        assertIntegrity(
                "TX-UNKNOWN-NO-START",
                "UNKNOWN"
        );
    }

    private void insertStation() {
        jdbcTemplate.update(
                """
                INSERT INTO charging_stations (
                    id,
                    name,
                    status
                )
                VALUES (?, ?, ?)
                """,
                STATION_ID,
                "Integrity Station",
                "ONLINE"
        );
    }

    private void insertTransaction(
            String transactionId,
            String status,
            int lastSequenceNumber
    ) {
        var endedAt =
                "ENDED".equals(status)
                        ? Timestamp.from(
                                ENDED_AT
                        )
                        : null;

        jdbcTemplate.update(
                """
                INSERT INTO charging_transactions (
                    station_id,
                    transaction_id,
                    evse_id,
                    connector_id,
                    status,
                    started_at,
                    ended_at,
                    last_sequence_number
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                """,
                STATION_ID,
                transactionId,
                1,
                1,
                status,
                Timestamp.from(
                        STARTED_AT
                ),
                endedAt,
                lastSequenceNumber
        );
    }

    private void insertReceipt(
            String transactionId,
            int sequenceNumber,
            String eventType
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO transaction_event_receipts (
                    station_id,
                    transaction_id,
                    sequence_number,
                    event_type
                )
                VALUES (?, ?, ?, ?)
                """,
                STATION_ID,
                transactionId,
                sequenceNumber,
                eventType
        );
    }

    private void assertIntegrity(
            String transactionId,
            String expectedStatus
    ) {
        var actual =
                jdbcTemplate.queryForObject(
                        """
                        SELECT integrity_status
                        FROM transaction_integrity_status
                        WHERE station_id = ?
                          AND transaction_id = ?
                        """,
                        String.class,
                        STATION_ID,
                        transactionId
                );

        assertEquals(
                expectedStatus,
                actual
        );
    }
}