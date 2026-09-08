package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationTransactionServiceTests {

    @Mock
    private StationTransactionReader transactionReader;

    @Mock
    private StationTransactionWriter transactionWriter;

    private StationTransactionService service;

    @BeforeEach
    void setUp() {
        service = new StationTransactionService(
                transactionReader,
                transactionWriter
        );
    }

    @Test
    void shouldPersistStartedTransaction() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        service.startTransaction(
                "STATION-003",
                "TX-001",
                1,
                1,
                startedAt,
                0
        );

        verify(transactionWriter).save(
                new ChargingTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        1,
                        TransactionStatus.ACTIVE,
                        startedAt,
                        null,
                        0
                )
        );
    }

    @Test
    void shouldAdvanceActiveTransactionSequence() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ACTIVE,
                                startedAt,
                                null,
                                0
                        )
                )
        );

        service.updateTransaction(
                "STATION-003",
                "TX-001",
                1
        );

        verify(transactionWriter).save(
                new ChargingTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        1,
                        TransactionStatus.ACTIVE,
                        startedAt,
                        null,
                        1
                )
        );
    }

    @Test
    void shouldEndActiveTransaction() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        var endedAt = Instant.parse(
                "2026-09-08T11:15:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ACTIVE,
                                startedAt,
                                null,
                                2
                        )
                )
        );

        service.endTransaction(
                "STATION-003",
                "TX-001",
                endedAt,
                3
        );

        verify(transactionWriter).save(
                new ChargingTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        1,
                        TransactionStatus.ENDED,
                        startedAt,
                        endedAt,
                        3
                )
        );
    }

    @Test
    void shouldRejectOlderTransactionSequenceNumber() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ACTIVE,
                                startedAt,
                                null,
                                3
                        )
                )
        );

        assertThatThrownBy(() ->
                service.updateTransaction(
                        "STATION-003",
                        "TX-001",
                        2
                )
        ).isInstanceOf(
                InvalidTransactionSequenceException.class
        );
    }

    @Test
    void shouldRejectUpdateForEndedTransaction() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        var endedAt = Instant.parse(
                "2026-09-08T11:15:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ENDED,
                                startedAt,
                                endedAt,
                                3
                        )
                )
        );

        assertThatThrownBy(() ->
                service.updateTransaction(
                        "STATION-003",
                        "TX-001",
                        4
                )
        ).isInstanceOf(
                TransactionNotActiveException.class
        );
    }

    @Test
    void shouldRejectEndingAlreadyEndedTransaction() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        var endedAt = Instant.parse(
                "2026-09-08T11:15:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingTransaction(
                                "STATION-003",
                                "TX-001",
                                1,
                                1,
                                TransactionStatus.ENDED,
                                startedAt,
                                endedAt,
                                3
                        )
                )
        );

        assertThatThrownBy(() ->
                service.endTransaction(
                        "STATION-003",
                        "TX-001",
                        Instant.parse(
                                "2026-09-08T11:20:00Z"
                        ),
                        4
                )
        ).isInstanceOf(
                TransactionNotActiveException.class
        );
    }
}