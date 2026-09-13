package com.voltgrid.station.messaging.outbox;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false"
        }
)
@Testcontainers
class OutboxClaimConcurrencyIntegrationTests {

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
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void cleanDatabase() {
        outboxEventRepository.deleteAll();
    }

    @Test
    void shouldClaimDifferentRowsWhenRelaysRunConcurrently()
            throws Exception {

        var firstEventId =
                UUID.randomUUID();

        var secondEventId =
                UUID.randomUUID();

        saveEvent(
                firstEventId,
                "STATION-CONCURRENT-001",
                Instant.parse(
                        "2026-09-13T16:00:00Z"
                )
        );

        saveEvent(
                secondEventId,
                "STATION-CONCURRENT-002",
                Instant.parse(
                        "2026-09-13T16:00:01Z"
                )
        );

        var firstRowClaimed =
                new CountDownLatch(1);

        var releaseFirstTransaction =
                new CountDownLatch(1);

        var executor =
                Executors.newFixedThreadPool(
                        2
                );

        try {
            var firstClaim =
                    executor.submit(
                            () ->
                                    claimFirstAndHoldLock(
                                            firstRowClaimed,
                                            releaseFirstTransaction
                                    )
                    );

            assertTrue(
                    firstRowClaimed.await(
                            5,
                            TimeUnit.SECONDS
                    ),
                    "First transaction did not claim an outbox row"
            );

            var secondClaim =
                    executor.submit(
                            this::claimNext
                    );

            /*
             * The first transaction is deliberately
             * still holding its row lock here.
             *
             * With SKIP LOCKED, the second transaction
             * should immediately claim the next row.
             *
             * Without SKIP LOCKED, this call would wait
             * for the first transaction to release its lock.
             */
            var secondClaimedId =
                    secondClaim.get(
                            5,
                            TimeUnit.SECONDS
                    );

            releaseFirstTransaction.countDown();

            var firstClaimedId =
                    firstClaim.get(
                            5,
                            TimeUnit.SECONDS
                    );

            assertThat(
                    firstClaimedId
            ).isEqualTo(
                    firstEventId
            );

            assertThat(
                    secondClaimedId
            ).isEqualTo(
                    secondEventId
            );

            assertThat(
                    secondClaimedId
            ).isNotEqualTo(
                    firstClaimedId
            );

        } finally {
            releaseFirstTransaction.countDown();

            executor.shutdownNow();

            assertTrue(
                    executor.awaitTermination(
                            5,
                            TimeUnit.SECONDS
                    )
            );
        }
    }

    private UUID claimFirstAndHoldLock(
            CountDownLatch firstRowClaimed,
            CountDownLatch releaseFirstTransaction
    ) {
        var transaction =
                new TransactionTemplate(
                        transactionManager
                );

        return transaction.execute(
                status -> {
                    var event =
                            outboxEventRepository
                                    .findNextUnpublishedForUpdate()
                                    .orElseThrow();

                    firstRowClaimed.countDown();

                    try {
                        if (!releaseFirstTransaction.await(
                                10,
                                TimeUnit.SECONDS
                        )) {
                            throw new IllegalStateException(
                                    "Timed out waiting to release first transaction"
                            );
                        }

                    } catch (InterruptedException exception) {
                        Thread.currentThread()
                                .interrupt();

                        throw new IllegalStateException(
                                "Interrupted while holding outbox row lock",
                                exception
                        );
                    }

                    return event.getId();
                }
        );
    }

    private UUID claimNext() {
        var transaction =
                new TransactionTemplate(
                        transactionManager
                );

        return transaction.execute(
                status ->
                        outboxEventRepository
                                .findNextUnpublishedForUpdate()
                                .orElseThrow()
                                .getId()
        );
    }

    private void saveEvent(
            UUID eventId,
            String stationId,
            Instant createdAt
    ) {
        outboxEventRepository.saveAndFlush(
                new OutboxEventEntity(
                        eventId,
                        "ChargingStation",
                        stationId,
                        "StationStatusChanged",
                        """
                        {
                          "eventId": "%s",
                          "stationId": "%s",
                          "previousStatus": "OFFLINE",
                          "currentStatus": "ONLINE"
                        }
                        """
                                .formatted(
                                        eventId,
                                        stationId
                                ),
                        createdAt,
                        createdAt
                )
        );
    }
}