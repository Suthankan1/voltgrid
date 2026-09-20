package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionKey;
import com.voltgrid.station.domain.TransactionEventType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JpaTransactionEventReceiptReaderTests {

    @Mock
    private TransactionEventReceiptJpaRepository repository;

    private JpaTransactionEventReceiptReader reader;

    @BeforeEach
    void setUp() {
        reader = new JpaTransactionEventReceiptReader(
                repository
        );
    }

    @Test
    void shouldReturnOnlyExactRequestedTransactionPairs() {
        var stationATransaction1 =
                receipt(
                        "STATION-A",
                        "TX-1",
                        0,
                        TransactionEventType.STARTED
                );

        var stationATransaction2 =
                receipt(
                        "STATION-A",
                        "TX-2",
                        0,
                        TransactionEventType.STARTED
                );

        var stationBTransaction1 =
                receipt(
                        "STATION-B",
                        "TX-1",
                        0,
                        TransactionEventType.STARTED
                );

        var stationBTransaction2 =
                receipt(
                        "STATION-B",
                        "TX-2",
                        0,
                        TransactionEventType.STARTED
                );

        when(
                repository
                        .findByIdStationIdInAndIdTransactionIdInOrderByIdStationIdAscIdTransactionIdAscIdSequenceNumberAsc(
                                List.of(
                                        "STATION-A",
                                        "STATION-B"
                                ),
                                List.of(
                                        "TX-1",
                                        "TX-2"
                                )
                        )
        ).thenReturn(
                List.of(
                        stationATransaction1,
                        stationATransaction2,
                        stationBTransaction1,
                        stationBTransaction2
                )
        );

        var result =
                reader.findByTransactions(
                        List.of(
                                new TransactionKey(
                                        "STATION-A",
                                        "TX-1"
                                ),
                                new TransactionKey(
                                        "STATION-B",
                                        "TX-2"
                                )
                        )
                );

        assertEquals(
                2,
                result.size()
        );

        assertEquals(
                "STATION-A",
                result.get(0).stationId()
        );

        assertEquals(
                "TX-1",
                result.get(0).transactionId()
        );

        assertEquals(
                "STATION-B",
                result.get(1).stationId()
        );

        assertEquals(
                "TX-2",
                result.get(1).transactionId()
        );

        verify(repository)
                .findByIdStationIdInAndIdTransactionIdInOrderByIdStationIdAscIdTransactionIdAscIdSequenceNumberAsc(
                        List.of(
                                "STATION-A",
                                "STATION-B"
                        ),
                        List.of(
                                "TX-1",
                                "TX-2"
                        )
                );
    }

    @Test
    void shouldSkipRepositoryWhenNoTransactionsAreRequested() {
        var result =
                reader.findByTransactions(
                        List.of()
                );

        assertEquals(
                List.of(),
                result
        );
    }

    private TransactionEventReceiptEntity receipt(
            String stationId,
            String transactionId,
            int sequenceNumber,
            TransactionEventType eventType
    ) {
        var id =
                mock(
                        TransactionEventReceiptId.class
                );

        when(id.getStationId())
                .thenReturn(stationId);

        when(id.getTransactionId())
                .thenReturn(transactionId);

        when(id.getSequenceNumber())
                .thenReturn(sequenceNumber);

        var entity =
                mock(
                        TransactionEventReceiptEntity.class
                );

        when(entity.getId())
                .thenReturn(id);

        when(entity.getEventType())
                .thenReturn(eventType);

        return entity;
    }
}