package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionQueryService;
import com.voltgrid.station.application.NetworkTransactionSnapshot;
import com.voltgrid.station.application.StationTransactionQueryService;
import com.voltgrid.station.application.TransactionCompletenessService;
import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionCompleteness;
import com.voltgrid.station.domain.TransactionDataStatus;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationTransactionGlobalQueryTests {

    @Mock
    private StationTransactionQueryService queryService;

    @Mock
    private TransactionCompletenessService completenessService;

    @Mock
    private NetworkTransactionQueryService networkTransactionQueryService;

    private StationTransactionGraphQlController controller;

    @BeforeEach
    void setUp() {
        controller = new StationTransactionGraphQlController(
                queryService,
                completenessService,
                networkTransactionQueryService
        );
    }

    @Test
    void shouldExposeAllTransactions() {
        var transaction = transaction();

        when(queryService.findAll())
                .thenReturn(List.of(transaction));

        var result = controller.transactions();

        assertEquals(1, result.size());

        var view = result.getFirst();

        assertEquals(
                "AWS-CP-001",
                view.stationId()
        );

        assertEquals(
                "AWS-DEMO-TX-0187",
                view.transactionId()
        );

        assertEquals(
                TransactionStatus.ENDED,
                view.status()
        );

        assertEquals(
                4,
                view.lastSequenceNumber()
        );

        verify(queryService).findAll();
    }

    @Test
    void shouldExposeNetworkTransactionsWithCompleteness() {
        var transaction = transaction();

        var completeness = new TransactionCompleteness(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                TransactionDataStatus.INCOMPLETE,
                0,
                4,
                List.of(2)
        );

        var snapshot = new NetworkTransactionSnapshot(
                transaction,
                completeness
        );

        when(networkTransactionQueryService.findAll())
                .thenReturn(List.of(snapshot));

        var result = controller.networkTransactions();

        assertEquals(1, result.size());

        var view = result.getFirst();

        assertEquals(
                "AWS-CP-001",
                view.transaction().stationId()
        );

        assertEquals(
                "AWS-DEMO-TX-0187",
                view.transaction().transactionId()
        );

        assertEquals(
                TransactionStatus.ENDED,
                view.transaction().status()
        );

        assertEquals(
                TransactionDataStatus.INCOMPLETE,
                view.completeness().status()
        );

        assertEquals(
                0,
                view.completeness().firstSequenceNumber()
        );

        assertEquals(
                4,
                view.completeness().lastSequenceNumber()
        );

        assertEquals(
                List.of(2),
                view.completeness().missingSequenceNumbers()
        );

        verify(networkTransactionQueryService).findAll();
    }

    private ChargingTransaction transaction() {
        return new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse("2026-09-18T09:01:00Z"),
                Instant.parse("2026-09-18T09:16:00Z"),
                4
        );
    }
}