package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationTransactionQueryServiceTests {

    @Mock
    private StationTransactionReader transactionReader;

    @Mock
    private TransactionMeterSampleReader meterSampleReader;

    private StationTransactionQueryService service;

    @BeforeEach
    void setUp() {
        service = new StationTransactionQueryService(
                transactionReader,
                meterSampleReader
        );
    }

    @Test
    void shouldReturnAllTransactionsFromReader() {
        var newest = new ChargingTransaction(
                "station-b",
                "tx-newest",
                2,
                1,
                TransactionStatus.ACTIVE,
                Instant.parse("2026-09-19T02:00:00Z"),
                null,
                4
        );

        var older = new ChargingTransaction(
                "station-a",
                "tx-older",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse("2026-09-18T02:00:00Z"),
                Instant.parse("2026-09-18T03:00:00Z"),
                8
        );

        when(transactionReader.findAll())
                .thenReturn(List.of(newest, older));

        var result = service.findAll();

        assertEquals(
                List.of(newest, older),
                result
        );

        verify(transactionReader).findAll();
        verifyNoInteractions(meterSampleReader);
    }
}