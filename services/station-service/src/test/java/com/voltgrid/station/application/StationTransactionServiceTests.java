package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionEventReceipt;
import com.voltgrid.station.domain.TransactionEventType;
import com.voltgrid.station.domain.TransactionMeterSample;
import com.voltgrid.station.domain.TransactionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationTransactionServiceTests {

    @Mock
    private StationTransactionReader transactionReader;

    @Mock
    private StationTransactionWriter transactionWriter;

    @Mock
    private TransactionMeterSampleWriter meterSampleWriter;

    @Mock
    private TransactionEventReceiptWriter eventReceiptWriter;

    @Mock
    private TransactionEventReceiptReader eventReceiptReader;

    private StationTransactionService service;

    @BeforeEach
    void setUp() {
        service = new StationTransactionService(
                transactionReader,
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter,
                eventReceiptReader
        );
    }

    @Test
    void shouldPersistStartedTransaction() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        when(
                transactionReader.findById(
                        "STATION-003",
                        "TX-001"
                )
        ).thenReturn(
                Optional.empty()
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

        verify(eventReceiptWriter).save(
                new TransactionEventReceipt(
                        "STATION-003",
                        "TX-001",
                        0,
                        TransactionEventType.STARTED
                )
        );

        verifyNoInteractions(
                meterSampleWriter
        );
    }

    @Test
    void shouldAdvanceActiveTransactionSequenceWithoutMeterSamples() {
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

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        1
                )
        ).thenReturn(
                Optional.empty()
        );

        service.updateTransaction(
                "STATION-003",
                "TX-001",
                1,
                List.of()
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

        verify(eventReceiptWriter).save(
                new TransactionEventReceipt(
                        "STATION-003",
                        "TX-001",
                        1,
                        TransactionEventType.UPDATED
                )
        );

        verifyNoInteractions(
                meterSampleWriter
        );
    }

    @Test
    void shouldAdvanceTransactionAndPersistMeterSamples() {
        var startedAt = Instant.parse(
                "2026-09-08T10:30:00Z"
        );

        var sampledAt = Instant.parse(
                "2026-09-08T10:35:00Z"
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

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        1
                )
        ).thenReturn(
                Optional.empty()
        );

        var samples = List.of(
                new TransactionMeterSample(
                        "STATION-003",
                        "TX-001",
                        1,
                        sampledAt,
                        new BigDecimal("1250.5"),
                        "Energy.Active.Import.Register",
                        "Sample.Periodic",
                        null,
                        "Outlet",
                        "Wh",
                        0
                ),
                new TransactionMeterSample(
                        "STATION-003",
                        "TX-001",
                        1,
                        sampledAt,
                        new BigDecimal("7200"),
                        "Power.Active.Import",
                        "Sample.Periodic",
                        null,
                        "Outlet",
                        "W",
                        0
                )
        );

        service.updateTransaction(
                "STATION-003",
                "TX-001",
                1,
                samples
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

        verify(meterSampleWriter)
                .saveAll(samples);

        verify(eventReceiptWriter).save(
                new TransactionEventReceipt(
                        "STATION-003",
                        "TX-001",
                        1,
                        TransactionEventType.UPDATED
                )
        );
    }

    @Test
    void shouldPersistLateUpdatedTransactionWithoutMovingLastSequenceNumber() {
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
                                4
                        )
                )
        );

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        2
                )
        ).thenReturn(
                Optional.empty()
        );

        var samples = List.of(
                new TransactionMeterSample(
                        "STATION-003",
                        "TX-001",
                        2,
                        Instant.parse(
                                "2026-09-08T10:40:00Z"
                        ),
                        new BigDecimal("1850.75"),
                        "Energy.Active.Import.Register",
                        "Sample.Periodic",
                        null,
                        "Outlet",
                        "Wh",
                        0
                )
        );

        service.updateTransaction(
                "STATION-003",
                "TX-001",
                2,
                samples
        );

        verifyNoInteractions(
                transactionWriter
        );

        verify(meterSampleWriter)
                .saveAll(samples);

        verify(eventReceiptWriter).save(
                new TransactionEventReceipt(
                        "STATION-003",
                        "TX-001",
                        2,
                        TransactionEventType.UPDATED
                )
        );
    }

    @Test
    void shouldIgnoreAlreadyReceivedUpdatedTransaction() {
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
                                2
                        )
                )
        );

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        2
                )
        ).thenReturn(
                Optional.of(
                        new TransactionEventReceipt(
                                "STATION-003",
                                "TX-001",
                                2,
                                TransactionEventType.UPDATED
                        )
                )
        );

        service.updateTransaction(
                "STATION-003",
                "TX-001",
                2,
                List.of()
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldRejectConflictingTransactionEventTypeForSameSequenceNumber() {
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

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        2
                )
        ).thenReturn(
                Optional.of(
                        new TransactionEventReceipt(
                                "STATION-003",
                                "TX-001",
                                2,
                                TransactionEventType.ENDED
                        )
                )
        );

        assertThatThrownBy(() ->
                service.updateTransaction(
                        "STATION-003",
                        "TX-001",
                        2,
                        List.of()
                )
        ).isInstanceOf(
                ConflictingTransactionEventException.class
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldRejectForwardUpdateForEndedTransaction() {
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

        when(
                eventReceiptReader.findById(
                        "STATION-003",
                        "TX-001",
                        4
                )
        ).thenReturn(
                Optional.empty()
        );

        assertThatThrownBy(() ->
                service.updateTransaction(
                        "STATION-003",
                        "TX-001",
                        4,
                        List.of()
                )
        ).isInstanceOf(
                TransactionNotActiveException.class
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
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

        verify(eventReceiptWriter).save(
                new TransactionEventReceipt(
                        "STATION-003",
                        "TX-001",
                        3,
                        TransactionEventType.ENDED
                )
        );

        verifyNoInteractions(
                meterSampleWriter
        );
    }

    @Test
    void shouldRejectEndingAlreadyEndedTransactionWithDifferentSequenceNumber() {
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

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldIgnoreDuplicateStartedTransaction() {
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

        service.startTransaction(
                "STATION-003",
                "TX-001",
                1,
                1,
                startedAt,
                0
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldRejectConflictingDuplicateStartedTransaction() {
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

        assertThatThrownBy(() ->
                service.startTransaction(
                        "STATION-003",
                        "TX-001",
                        2,
                        1,
                        startedAt,
                        0
                )
        ).isInstanceOf(
                InvalidTransactionSequenceException.class
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldIgnoreDuplicateEndedTransaction() {
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

        service.endTransaction(
                "STATION-003",
                "TX-001",
                endedAt,
                3
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }

    @Test
    void shouldRejectConflictingDuplicateEndedTransaction() {
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
                                "2026-09-08T11:16:00Z"
                        ),
                        3
                )
        ).isInstanceOf(
                TransactionNotActiveException.class
        );

        verifyNoInteractions(
                transactionWriter,
                meterSampleWriter,
                eventReceiptWriter
        );
    }
}