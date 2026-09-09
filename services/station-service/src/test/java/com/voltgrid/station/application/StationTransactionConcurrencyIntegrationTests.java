package com.voltgrid.station.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest
class StationTransactionConcurrencyIntegrationTests {

    private static final String STATION_ID =
            "STATION-CONCURRENCY";

    private static final String TRANSACTION_ID =
            "TX-CONCURRENCY";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(
                    "postgres:18.6"
            );

    @Autowired
    private StationTransactionService transactionService;

    @Autowired
    private StationTransactionReader transactionReader;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        clearDatabase();
        createTransaction();
    }

    @Test
    void shouldBlockConcurrentTransactionUpdateUntilRowLockIsReleased()
            throws Exception {

        var executor =
                Executors.newFixedThreadPool(2);

        var lockAcquired =
                new CountDownLatch(1);

        var releaseLock =
                new CountDownLatch(1);

        var updateStarted =
                new CountDownLatch(1);

        try {
            var lockHolder = executor.submit(() -> {
                var transactionTemplate =
                        new TransactionTemplate(
                                transactionManager
                        );

                transactionTemplate.executeWithoutResult(
                        status -> {
                            var transaction =
                                    transactionReader
                                            .findByIdForUpdate(
                                                    STATION_ID,
                                                    TRANSACTION_ID
                                            );

                            assertThat(transaction)
                                    .isPresent();

                            lockAcquired.countDown();

                            await(releaseLock);
                        }
                );
            });

            assertThat(
                    lockAcquired.await(
                            5,
                            TimeUnit.SECONDS
                    )
            ).isTrue();

            var updateFuture = executor.submit(() -> {
                updateStarted.countDown();

                transactionService.updateTransaction(
                        STATION_ID,
                        TRANSACTION_ID,
                        2,
                        List.of()
                );
            });

            assertThat(
                    updateStarted.await(
                            5,
                            TimeUnit.SECONDS
                    )
            ).isTrue();

            /*
             * The first transaction is still holding
             * SELECT ... FOR UPDATE.
             *
             * The service call must therefore still be
             * blocked instead of completing concurrently.
             */
            assertThatThrownBy(() ->
                    updateFuture.get(
                            300,
                            TimeUnit.MILLISECONDS
                    )
            ).isInstanceOf(
                    TimeoutException.class
            );

            releaseLock.countDown();

            updateFuture.get(
                    5,
                    TimeUnit.SECONDS
            );

            lockHolder.get(
                    5,
                    TimeUnit.SECONDS
            );

            assertThat(
                    readLastSequenceNumber()
            ).isEqualTo(2);

            assertThat(
                    readReceiptSequenceNumbers()
            ).containsExactly(
                    0,
                    1,
                    2
            );

        } finally {
            releaseLock.countDown();

            executor.shutdownNow();

            executor.awaitTermination(
                    5,
                    TimeUnit.SECONDS
            );
        }
    }

    @Test
    void shouldPreserveHighestSequenceNumberWhenUpdatesArriveConcurrently()
            throws Exception {

        var executor =
                Executors.newFixedThreadPool(2);

        var start =
                new CountDownLatch(1);

        try {
            var sequenceTwo = executor.submit(() -> {
                await(start);

                transactionService.updateTransaction(
                        STATION_ID,
                        TRANSACTION_ID,
                        2,
                        List.of()
                );
            });

            var sequenceThree = executor.submit(() -> {
                await(start);

                transactionService.updateTransaction(
                        STATION_ID,
                        TRANSACTION_ID,
                        3,
                        List.of()
                );
            });

            /*
             * Release both worker threads together.
             */
            start.countDown();

            sequenceTwo.get(
                    5,
                    TimeUnit.SECONDS
            );

            sequenceThree.get(
                    5,
                    TimeUnit.SECONDS
            );

            /*
             * Regardless of which request obtained the
             * row lock first, the transaction must never
             * regress from 3 back to 2.
             */
            assertThat(
                    readLastSequenceNumber()
            ).isEqualTo(3);

            /*
             * Both events must still be retained.
             *
             * If seq=3 wins the lock first, seq=2 becomes
             * a legitimate late event after it obtains
             * the lock.
             */
            assertThat(
                    readReceiptSequenceNumbers()
            ).containsExactly(
                    0,
                    1,
                    2,
                    3
            );

        } finally {
            start.countDown();

            executor.shutdownNow();

            executor.awaitTermination(
                    5,
                    TimeUnit.SECONDS
            );
        }
    }

    private void createTransaction() {
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
                "Concurrency Test Station",
                "ONLINE"
        );

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
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
                """,
                STATION_ID,
                TRANSACTION_ID,
                1,
                1,
                "ACTIVE",
                OffsetDateTime.parse(
                        "2026-09-09T10:00:00Z"
                ),
                1
        );

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
                TRANSACTION_ID,
                0,
                "STARTED"
        );

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
                TRANSACTION_ID,
                1,
                "UPDATED"
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

    private int readLastSequenceNumber() {
        return jdbcTemplate.queryForObject(
                """
                SELECT last_sequence_number
                FROM charging_transactions
                WHERE station_id = ?
                  AND transaction_id = ?
                """,
                Integer.class,
                STATION_ID,
                TRANSACTION_ID
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

    private void await(
            CountDownLatch latch
    ) {
        try {
            if (!latch.await(
                    5,
                    TimeUnit.SECONDS
            )) {
                throw new IllegalStateException(
                        "Timed out waiting for concurrency test latch"
                );
            }
        } catch (InterruptedException exception) {
            Thread.currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "Concurrency test thread was interrupted",
                    exception
            );
        }
    }

    @Test
    void shouldTreatConcurrentIdenticalStartedEventsAsIdempotent()
            throws Exception {

        var transactionId =
                "TX-CONCURRENT-START";

        var startedAt =
                java.time.Instant.parse(
                        "2026-09-09T11:00:00Z"
                );

        var executor =
                Executors.newFixedThreadPool(2);

        var start =
                new CountDownLatch(1);

        try {
            var first = executor.submit(() -> {
                await(start);

                transactionService.startTransaction(
                        STATION_ID,
                        transactionId,
                        1,
                        1,
                        startedAt,
                        0
                );
            });

            var second = executor.submit(() -> {
                await(start);

                transactionService.startTransaction(
                        STATION_ID,
                        transactionId,
                        1,
                        1,
                        startedAt,
                        0
                );
            });

            start.countDown();

            first.get(
                    5,
                    TimeUnit.SECONDS
            );

            second.get(
                    5,
                    TimeUnit.SECONDS
            );

            var transactionCount =
                    jdbcTemplate.queryForObject(
                            """
                            SELECT COUNT(*)
                            FROM charging_transactions
                            WHERE station_id = ?
                              AND transaction_id = ?
                            """,
                            Integer.class,
                            STATION_ID,
                            transactionId
                    );

            assertThat(transactionCount)
                    .isEqualTo(1);

            var receiptCount =
                    jdbcTemplate.queryForObject(
                            """
                            SELECT COUNT(*)
                            FROM transaction_event_receipts
                            WHERE station_id = ?
                              AND transaction_id = ?
                              AND sequence_number = 0
                              AND event_type = 'STARTED'
                            """,
                            Integer.class,
                            STATION_ID,
                            transactionId
                    );

            assertThat(receiptCount)
                    .isEqualTo(1);

        } finally {
            start.countDown();

            executor.shutdownNow();

            executor.awaitTermination(
                    5,
                    TimeUnit.SECONDS
            );
        }
    }
}