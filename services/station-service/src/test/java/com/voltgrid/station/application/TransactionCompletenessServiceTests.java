package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionDataStatus;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionCompletenessServiceTests {

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
    void shouldMarkEndedTransactionCompleteWhenAllSequencesWereReceived() {
        var transaction = endedTransaction(
                3
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of(
                        receipt(
                                0,
                                TransactionEventType.STARTED
                        ),
                        receipt(
                                1,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                2,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                3,
                                TransactionEventType.ENDED
                        )
                )
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(result.status())
                .isEqualTo(
                        TransactionDataStatus.COMPLETE
                );

        assertThat(result.firstSequenceNumber())
                .isEqualTo(0);

        assertThat(result.lastSequenceNumber())
                .isEqualTo(3);

        assertThat(result.missingSequenceNumbers())
                .isEmpty();
    }

    @Test
    void shouldMarkEndedTransactionIncompleteWhenSequenceIsMissing() {
        var transaction = endedTransaction(
                4
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of(
                        receipt(
                                0,
                                TransactionEventType.STARTED
                        ),
                        receipt(
                                1,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                3,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                4,
                                TransactionEventType.ENDED
                        )
                )
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(result.status())
                .isEqualTo(
                        TransactionDataStatus.INCOMPLETE
                );

        assertThat(result.missingSequenceNumbers())
                .containsExactly(2);
    }

    @Test
    void shouldReportMultipleMissingSequences() {
        var transaction = endedTransaction(
                6
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of(
                        receipt(
                                0,
                                TransactionEventType.STARTED
                        ),
                        receipt(
                                2,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                5,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                6,
                                TransactionEventType.ENDED
                        )
                )
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(
                result.missingSequenceNumbers()
        ).containsExactly(
                1,
                3,
                4
        );
    }

    @Test
    void shouldKeepActiveTransactionInProgressEvenWhenSequenceIsMissing() {
        var transaction =
                new ChargingTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        1,
                        TransactionStatus.ACTIVE,
                        Instant.parse(
                                "2026-09-09T09:00:00Z"
                        ),
                        null,
                        3
                );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of(
                        receipt(
                                0,
                                TransactionEventType.STARTED
                        ),
                        receipt(
                                1,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                3,
                                TransactionEventType.UPDATED
                        )
                )
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(result.status())
                .isEqualTo(
                        TransactionDataStatus.IN_PROGRESS
                );

        assertThat(result.missingSequenceNumbers())
                .containsExactly(2);
    }

    @Test
    void shouldReturnUnknownWhenTransactionHasNoReceiptHistory() {
        var transaction = endedTransaction(
                3
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of()
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(result.status())
                .isEqualTo(
                        TransactionDataStatus.UNKNOWN
                );

        assertThat(result.firstSequenceNumber())
                .isNull();

        assertThat(result.missingSequenceNumbers())
                .isEmpty();
    }

    @Test
    void shouldReturnUnknownWhenStartedReceiptIsMissing() {
        var transaction = endedTransaction(
                3
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.of(transaction)
        );

        when(
                receiptReader.findByTransaction(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                List.of(
                        receipt(
                                1,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                2,
                                TransactionEventType.UPDATED
                        ),
                        receipt(
                                3,
                                TransactionEventType.ENDED
                        )
                )
        );

        var result = service.calculate(
                "STATION-003",
                "TX-001"
        );

        assertThat(result.status())
                .isEqualTo(
                        TransactionDataStatus.UNKNOWN
                );
    }

    @Test
    void shouldRejectUnknownTransaction() {
        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-404"
                )
        ).thenReturn(
                Optional.empty()
        );

        assertThatThrownBy(() ->
                service.calculate(
                        "STATION-003",
                        "TX-404"
                )
        ).isInstanceOf(
                TransactionNotFoundException.class
        );
    }

    private ChargingTransaction endedTransaction(
            int lastSequenceNumber
    ) {
        return new ChargingTransaction(
                "STATION-003",
                "TX-001",
                1,
                1,
                TransactionStatus.ENDED,
                Instant.parse(
                        "2026-09-09T09:00:00Z"
                ),
                Instant.parse(
                        "2026-09-09T09:30:00Z"
                ),
                lastSequenceNumber
        );
    }

    private TransactionEventReceipt receipt(
            int sequenceNumber,
            TransactionEventType eventType
    ) {
        return new TransactionEventReceipt(
                "STATION-003",
                "TX-001",
                sequenceNumber,
                eventType
        );
    }
}