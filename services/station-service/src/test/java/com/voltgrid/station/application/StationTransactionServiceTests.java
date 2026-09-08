package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class StationTransactionServiceTests {

    @Mock
    private StationTransactionWriter transactionWriter;

    private StationTransactionService service;

    @BeforeEach
    void setUp() {
        service = new StationTransactionService(
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
                        0
                )
        );
    }
}