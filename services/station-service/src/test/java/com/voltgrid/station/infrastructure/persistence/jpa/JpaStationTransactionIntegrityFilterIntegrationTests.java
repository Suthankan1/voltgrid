package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.domain.TransactionDataStatus;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class JpaStationTransactionIntegrityFilterIntegrationTests {

    private static final String STATION_ID =
            "INTEGRITY-FILTER-STATION";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JpaStationTransactionReader reader;

    @Test
    void shouldFilterIncompleteTransactionsBeforePagination() {
        insertStation();

        insertEndedTransaction(
                "TX-INCOMPLETE-NEW",
                Instant.parse(
                        "2026-09-21T10:00:00Z"
                ),
                4
        );

        insertReceipt(
                "TX-INCOMPLETE-NEW",
                0,
                "STARTED"
        );

        insertReceipt(
                "TX-INCOMPLETE-NEW",
                1,
                "UPDATED"
        );

        insertReceipt(
                "TX-INCOMPLETE-NEW",
                3,
                "UPDATED"
        );

        insertReceipt(
                "TX-INCOMPLETE-NEW",
                4,
                "ENDED"
        );

        insertEndedTransaction(
                "TX-INCOMPLETE-OLD",
                Instant.parse(
                        "2026-09-21T09:00:00Z"
                ),
                3
        );

        insertReceipt(
                "TX-INCOMPLETE-OLD",
                0,
                "STARTED"
        );

        insertReceipt(
                "TX-INCOMPLETE-OLD",
                2,
                "UPDATED"
        );

        insertReceipt(
                "TX-INCOMPLETE-OLD",
                3,
                "ENDED"
        );

        insertEndedTransaction(
                "TX-COMPLETE",
                Instant.parse(
                        "2026-09-21T11:00:00Z"
                ),
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

        var result = reader.findPage(
                0,
                1,
                new TransactionPageFilter(
                        null,
                        null,
                        TransactionDataStatus.INCOMPLETE
                )
        );

        assertEquals(
                1,
                result.content().size()
        );

        assertEquals(
                "TX-INCOMPLETE-NEW",
                result
                        .content()
                        .getFirst()
                        .transactionId()
        );

        assertEquals(
                2,
                result.totalElements()
        );

        assertEquals(
                2,
                result.totalPages()
        );

        assertTrue(
                result.hasNext()
        );
    }

    @Test
    void shouldCombineIntegrityWithTransactionSearch() {
        insertStation();

        insertEndedTransaction(
                "ORDER-ALPHA",
                Instant.parse(
                        "2026-09-21T10:00:00Z"
                ),
                2
        );

        insertReceipt(
                "ORDER-ALPHA",
                0,
                "STARTED"
        );

        insertReceipt(
                "ORDER-ALPHA",
                2,
                "ENDED"
        );

        insertEndedTransaction(
                "ORDER-BETA",
                Instant.parse(
                        "2026-09-21T09:00:00Z"
                ),
                2
        );

        insertReceipt(
                "ORDER-BETA",
                0,
                "STARTED"
        );

        insertReceipt(
                "ORDER-BETA",
                2,
                "ENDED"
        );

        var result = reader.findPage(
                0,
                20,
                new TransactionPageFilter(
                        STATION_ID,
                        "alpha",
                        TransactionDataStatus.INCOMPLETE
                )
        );

        assertEquals(
                1,
                result.totalElements()
        );

        assertEquals(
                "ORDER-ALPHA",
                result
                        .content()
                        .getFirst()
                        .transactionId()
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
                "Integrity Filter Station",
                "ONLINE"
        );
    }

    private void insertEndedTransaction(
            String transactionId,
            Instant startedAt,
            int lastSequenceNumber
    ) {
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
                "ENDED",
                Timestamp.from(
                        startedAt
                ),
                Timestamp.from(
                        startedAt.plusSeconds(
                                1800
                        )
                ),
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
}