package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionDataStatus;
import com.voltgrid.station.domain.TransactionMeterSample;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest
class StationTransactionLifecycleIntegrationTests {

    private static final String STATION_ID =
            "STATION-LIFECYCLE";

    private static final String TRANSACTION_ID =
            "TX-LIFECYCLE";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(
                    "postgres:18.6"
            );

    @Autowired
    private StationTransactionService transactionService;

    @Autowired
    private TransactionCompletenessService completenessService;

    @Autowired
    private StationTransactionReader transactionReader;

    @Autowired
    private TransactionMeterSampleReader meterSampleReader;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        clearDatabase();

        jdbcTemplate.update(
                """
                INSERT INTO charging_stations (
                    id,
                    name,
                    status,
                    last_seen_at
                )
                VALUES (?, ?, ?, NULL)
                """,
                STATION_ID,
                "Lifecycle Test Station",
                "ONLINE"
        );
    }

    @Test
    void shouldRecoverIncompleteEndedTransactionWhenLateEventArrives() {

        var startedAt =
                Instant.parse(
                        "2026-09-09T10:00:00Z"
                );

        /*
         * Sequence 0:
         * transaction starts normally.
         */
        transactionService.startTransaction(
                STATION_ID,
                TRANSACTION_ID,
                1,
                1,
                startedAt,
                0
        );

        /*
         * Sequence 1:
         * normal forward update with a meter sample.
         */
        transactionService.updateTransaction(
                STATION_ID,
                TRANSACTION_ID,
                1,
                List.of(
                        meterSample(
                                1,
                                "2026-09-09T10:05:00Z",
                                "1000.0"
                        )
                )
        );

        /*
         * Intentionally skip sequence 2.
         *
         * Sequence 3 arrives first and advances
         * lastSequenceNumber from 1 to 3.
         */
        transactionService.updateTransaction(
                STATION_ID,
                TRANSACTION_ID,
                3,
                List.of(
                        meterSample(
                                3,
                                "2026-09-09T10:15:00Z",
                                "2000.0"
                        )
                )
        );

        /*
         * Sequence 4 ends the transaction.
         *
         * At this point receipts are:
         *
         * 0 STARTED
         * 1 UPDATED
         * 3 UPDATED
         * 4 ENDED
         *
         * Sequence 2 is still missing.
         */
        transactionService.endTransaction(
                STATION_ID,
                TRANSACTION_ID,
                Instant.parse(
                        "2026-09-09T10:20:00Z"
                ),
                4
        );

        var incomplete =
                completenessService.calculate(
                        STATION_ID,
                        TRANSACTION_ID
                );

        assertThat(
                incomplete.status()
        ).isEqualTo(
                TransactionDataStatus.INCOMPLETE
        );

        assertThat(
                incomplete.firstSequenceNumber()
        ).isEqualTo(0);

        assertThat(
                incomplete.lastSequenceNumber()
        ).isEqualTo(4);

        assertThat(
                incomplete.missingSequenceNumbers()
        ).containsExactly(2);

        /*
         * The missing sequence 2 arrives late,
         * after the transaction has already ended.
         *
         * It should be accepted as a legitimate
         * out-of-order update.
         */
        transactionService.updateTransaction(
                STATION_ID,
                TRANSACTION_ID,
                2,
                List.of(
                        meterSample(
                                2,
                                "2026-09-09T10:10:00Z",
                                "1500.0"
                        )
                )
        );

        var complete =
                completenessService.calculate(
                        STATION_ID,
                        TRANSACTION_ID
                );

        /*
         * Once sequence 2 is present, the receipt
         * ledger should contain every sequence
         * from 0 through 4.
         */
        assertThat(
                complete.status()
        ).isEqualTo(
                TransactionDataStatus.COMPLETE
        );

        assertThat(
                complete.firstSequenceNumber()
        ).isEqualTo(0);

        assertThat(
                complete.lastSequenceNumber()
        ).isEqualTo(4);

        assertThat(
                complete.missingSequenceNumbers()
        ).isEmpty();

        /*
         * Late sequence 2 must not move the transaction
         * state backwards.
         */
        var transaction =
                transactionReader.findById(
                        STATION_ID,
                        TRANSACTION_ID
                ).orElseThrow();

        assertThat(
                transaction.status()
        ).isEqualTo(
                TransactionStatus.ENDED
        );

        assertThat(
                transaction.lastSequenceNumber()
        ).isEqualTo(4);

        assertThat(
                transaction.endedAt()
        ).isEqualTo(
                Instant.parse(
                        "2026-09-09T10:20:00Z"
                )
        );

        /*
         * Meter data from the late sequence must
         * still be persisted.
         */
        var meterSamples =
                meterSampleReader.findByTransaction(
                        STATION_ID,
                        TRANSACTION_ID
                );

        assertThat(meterSamples)
                .extracting(
                        TransactionMeterSample::sequenceNumber
                )
                .containsExactly(
                        1,
                        2,
                        3
                );

        /*
         * Receipt ledger should now be complete.
         */
        assertThat(
                readReceiptSequenceNumbers()
        ).containsExactly(
                0,
                1,
                2,
                3,
                4
        );
    }

    private TransactionMeterSample meterSample(
            int sequenceNumber,
            String sampledAt,
            String value
    ) {
        return new TransactionMeterSample(
                STATION_ID,
                TRANSACTION_ID,
                sequenceNumber,
                Instant.parse(sampledAt),
                new BigDecimal(value),
                "Energy.Active.Import.Register",
                "Sample.Periodic",
                null,
                "Outlet",
                "Wh",
                0
        );
    }

    private List<Integer> readReceiptSequenceNumbers() {
        return jdbcTemplate.queryForList(
                """
                SELECT sequence_number
                FROM transaction_event_receipts
                WHERE station_id = ?
                  AND transaction_id = ?
                ORDER BY sequence_number
                """,
                Integer.class,
                STATION_ID,
                TRANSACTION_ID
        );
    }

    private void clearDatabase() {
        jdbcTemplate.update(
                "DELETE FROM transaction_meter_samples"
        );

        jdbcTemplate.update(
                "DELETE FROM transaction_event_receipts"
        );

        jdbcTemplate.update(
                "DELETE FROM charging_transactions"
        );

        jdbcTemplate.update(
                "DELETE FROM station_connectors"
        );

        jdbcTemplate.update(
                "DELETE FROM charging_stations"
        );
    }
}