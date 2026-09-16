package com.voltgrid.operations.application;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@Import(PostgresTestConfiguration.class)
class ProjectingStationStatusChangedHandlerConcurrencyIntegrationTests {

    @Autowired
    private ProjectingStationStatusChangedHandler handler;

    @Autowired
    private StationStatusProjectionRepository projectionRepository;

    @Autowired
    private ProcessedEventReceiptRepository receiptRepository;

    @BeforeEach
    void cleanDatabase() {
        receiptRepository.deleteAll();
        projectionRepository.deleteAll();
    }

    @Test
    void shouldProcessConcurrentDuplicateDeliveryOnlyOnce()
            throws Exception {

        var eventId =
                UUID.randomUUID();

        var event =
                new StationStatusChangedEvent(
                        eventId,
                        "STATION-CONCURRENT-001",
                        "OFFLINE",
                        "ONLINE",
                        Instant.parse(
                                "2026-09-16T15:00:00Z"
                        )
                );

        var ready =
                new CountDownLatch(
                        2
                );

        var start =
                new CountDownLatch(
                        1
                );

        var executor =
                Executors.newFixedThreadPool(
                        2
                );

        try {
            var first =
                    executor.submit(
                            () -> {
                                ready.countDown();

                                awaitStart(
                                        start
                                );

                                handler.handle(
                                        event
                                );
                            }
                    );

            var second =
                    executor.submit(
                            () -> {
                                ready.countDown();

                                awaitStart(
                                        start
                                );

                                handler.handle(
                                        event
                                );
                            }
                    );

            assertTrue(
                    ready.await(
                            5,
                            TimeUnit.SECONDS
                    ),
                    "Concurrent handlers did not become ready"
            );

            start.countDown();

            first.get(
                    10,
                    TimeUnit.SECONDS
            );

            second.get(
                    10,
                    TimeUnit.SECONDS
            );

            assertThat(
                    receiptRepository.count()
            ).isEqualTo(
                    1
            );

            assertThat(
                    projectionRepository.count()
            ).isEqualTo(
                    1
            );

            var receipt =
                    receiptRepository
                            .findById(
                                    eventId
                            )
                            .orElseThrow();

            assertThat(
                    receipt.getEventType()
            ).isEqualTo(
                    "StationStatusChanged"
            );

            var projection =
                    projectionRepository
                            .findById(
                                    "STATION-CONCURRENT-001"
                            )
                            .orElseThrow();

            assertThat(
                    projection.getCurrentStatus()
            ).isEqualTo(
                    "ONLINE"
            );

            assertThat(
                    projection.getLastEventId()
            ).isEqualTo(
                    eventId
            );

            assertThat(
                    projection.getStatusChangedAt()
            ).isEqualTo(
                    Instant.parse(
                            "2026-09-16T15:00:00Z"
                    )
            );

        } finally {
            start.countDown();

            executor.shutdownNow();

            assertTrue(
                    executor.awaitTermination(
                            5,
                            TimeUnit.SECONDS
                    )
            );
        }
    }

    private void awaitStart(
            CountDownLatch start
    ) {
        try {
            if (!start.await(
                    5,
                    TimeUnit.SECONDS
            )) {
                throw new IllegalStateException(
                        "Timed out waiting for concurrent start"
                );
            }

        } catch (InterruptedException exception) {
            Thread.currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "Interrupted while waiting for concurrent start",
                    exception
            );
        }
    }
}