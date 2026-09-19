package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionEventReceipt;
import com.voltgrid.station.domain.TransactionEventType;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionCompletenessBatchTests {

    @Mock
    private StationTransactionReader transactionReader;

    @Mock
    private TransactionEventReceiptReader receiptReader;

    private TransactionCompletenessService service;

    @BeforeEach
    void setUp() {
        service = new TransactionCompletenessService(
                transactionReader,
                receiptReader
        );
    }

    @Test
    void shouldCalculateNetworkCompletenessFromSingleReceiptRead() {
        var transaction = new ChargingTransaction(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse("2026-09-18T09:01:00Z"),
                Instant.parse("2026-09-18T09:16:00Z"),
                4
        );

        var receipts = List.of(
                new TransactionEventReceipt(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        0,
                        TransactionEventType.STARTED
                ),
                new TransactionEventReceipt(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        1,
                        TransactionEventType.UPDATED
                ),
                new TransactionEventReceipt(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        3,
                        TransactionEventType.UPDATED
                ),
                new TransactionEventReceipt(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        4,
                        TransactionEventType.ENDED
                )
        );

        when(receiptReader.findAll())
                .thenReturn(receipts);

        var result = service.calculateAll(
                List.of(transaction)
        );

        assertEquals(1, result.size());
        assertEquals(
                List.of(2),
                result.getFirst()
                        .missingSequenceNumbers()
        );

        verify(receiptReader).findAll();

        verify(
                transactionReader,
                never()
        ).findById(
                "AWS-CP-001",
                "AWS-DEMO-TX-0187"
        );
    }
}