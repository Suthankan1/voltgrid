package com.voltgrid.station.application;

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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NetworkTransactionPaginationTests {

    @Mock
    private StationTransactionReader transactionReader;

    @Mock
    private TransactionCompletenessService completenessService;

    private NetworkTransactionQueryService service;

    @BeforeEach
    void setUp() {
        service =
                new NetworkTransactionQueryService(
                        transactionReader,
                        completenessService
                );
    }

    @Test
    void shouldCalculateCompletenessOnlyForCurrentPage() {
        var transaction =
                new ChargingTransaction(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        1,
                        1,
                        TransactionStatus.ENDED,
                        Instant.parse(
                                "2026-09-18T09:01:00Z"
                        ),
                        Instant.parse(
                                "2026-09-18T09:16:00Z"
                        ),
                        4
                );

        var transactionPage =
                new PageResult<>(
                        List.of(transaction),
                        0,
                        20,
                        1,
                        1,
                        false
                );

        var completeness =
                new TransactionCompleteness(
                        "AWS-CP-001",
                        "AWS-DEMO-TX-0187",
                        TransactionDataStatus.INCOMPLETE,
                        0,
                        4,
                        List.of(2)
                );

        when(
                transactionReader.findPage(
                        0,
                        20
                )
        ).thenReturn(
                transactionPage
        );

        when(
                completenessService.calculateAll(
                        List.of(transaction)
                )
        ).thenReturn(
                List.of(completeness)
        );

        var result =
                service.findPage(
                        0,
                        20
                );

        assertEquals(
                1,
                result.content().size()
        );

        assertEquals(
                0,
                result.page()
        );

        assertEquals(
                20,
                result.size()
        );

        assertEquals(
                1,
                result.totalElements()
        );

        assertEquals(
                1,
                result.totalPages()
        );

        assertFalse(
                result.hasNext()
        );

        assertEquals(
                "AWS-DEMO-TX-0187",
                result
                        .content()
                        .getFirst()
                        .transaction()
                        .transactionId()
        );

        assertEquals(
                TransactionDataStatus.INCOMPLETE,
                result
                        .content()
                        .getFirst()
                        .completeness()
                        .status()
        );

        assertEquals(
                List.of(2),
                result
                        .content()
                        .getFirst()
                        .completeness()
                        .missingSequenceNumbers()
        );

        verify(transactionReader)
                .findPage(
                        0,
                        20
                );

        verify(completenessService)
                .calculateAll(
                        List.of(transaction)
                );
    }
}