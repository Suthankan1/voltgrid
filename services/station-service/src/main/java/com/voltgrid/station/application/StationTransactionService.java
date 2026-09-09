package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionEventReceipt;
import com.voltgrid.station.domain.TransactionEventType;
import com.voltgrid.station.domain.TransactionMeterSample;
import com.voltgrid.station.domain.TransactionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class StationTransactionService {

    private final StationTransactionReader transactionReader;
    private final StationTransactionWriter transactionWriter;
    private final TransactionMeterSampleWriter meterSampleWriter;
    private final TransactionEventReceiptWriter eventReceiptWriter;
    private final TransactionEventReceiptReader eventReceiptReader;

    public StationTransactionService(
            StationTransactionReader transactionReader,
            StationTransactionWriter transactionWriter,
            TransactionMeterSampleWriter meterSampleWriter,
            TransactionEventReceiptWriter eventReceiptWriter,
            TransactionEventReceiptReader eventReceiptReader
    ) {
        this.transactionReader = transactionReader;
        this.transactionWriter = transactionWriter;
        this.meterSampleWriter = meterSampleWriter;
        this.eventReceiptWriter = eventReceiptWriter;
        this.eventReceiptReader = eventReceiptReader;
    }

    @Transactional
    public void startTransaction(
            String stationId,
            String transactionId,
            int evseId,
            int connectorId,
            Instant startedAt,
            int sequenceNumber
    ) {
        var candidate =
                new ChargingTransaction(
                        stationId,
                        transactionId,
                        evseId,
                        connectorId,
                        TransactionStatus.ACTIVE,
                        startedAt,
                        null,
                        sequenceNumber
                );

        if (transactionWriter.createIfAbsent(
                candidate
        )) {
            recordReceipt(
                    stationId,
                    transactionId,
                    sequenceNumber,
                    TransactionEventType.STARTED
            );

            return;
        }

        /*
         * Another request, or an earlier request, already created
         * this transaction.
         *
         * PostgreSQL ON CONFLICT handles the creation race. We now
         * inspect the winning row to determine whether this event is
         * an exact retransmission or conflicting data.
         */
        var existing = transactionReader
                .findById(
                        stationId,
                        transactionId
                )
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Transaction creation conflict could not be resolved"
                        )
                );

        if (isDuplicateStart(
                existing,
                evseId,
                connectorId,
                startedAt,
                sequenceNumber
        )) {
            return;
        }

        throw new InvalidTransactionSequenceException(
                existing.lastSequenceNumber(),
                sequenceNumber
        );
    }

    @Transactional
    public void updateTransaction(
            String stationId,
            String transactionId,
            int sequenceNumber,
            List<TransactionMeterSample> meterSamples
    ) {
        var transaction =
                findTransactionForUpdate(
                        stationId,
                        transactionId
                );

        if (isAlreadyReceived(
                stationId,
                transactionId,
                sequenceNumber,
                TransactionEventType.UPDATED
        )) {
            return;
        }

        /*
         * A forward event advances lastSequenceNumber.
         *
         * A smaller sequence number with no existing receipt is a
         * legitimate late/out-of-order event. Its receipt and meter
         * samples are persisted without moving lastSequenceNumber
         * backwards.
         */
        if (sequenceNumber
                > transaction.lastSequenceNumber()) {

            ensureActive(transaction);

            transactionWriter.save(
                    new ChargingTransaction(
                            transaction.stationId(),
                            transaction.transactionId(),
                            transaction.evseId(),
                            transaction.connectorId(),
                            TransactionStatus.ACTIVE,
                            transaction.startedAt(),
                            null,
                            sequenceNumber
                    )
            );
        }

        if (!meterSamples.isEmpty()) {
            meterSampleWriter.saveAll(
                    meterSamples
            );
        }

        recordReceipt(
                stationId,
                transactionId,
                sequenceNumber,
                TransactionEventType.UPDATED
        );
    }

    @Transactional
    public void endTransaction(
            String stationId,
            String transactionId,
            Instant endedAt,
            int sequenceNumber
    ) {
        var transaction =
                findTransactionForUpdate(
                        stationId,
                        transactionId
                );

        if (isDuplicateEnd(
                transaction,
                endedAt,
                sequenceNumber
        )) {
            return;
        }

        ensureActive(transaction);

        ensureSequenceAdvances(
                transaction,
                sequenceNumber
        );

        transactionWriter.save(
                new ChargingTransaction(
                        transaction.stationId(),
                        transaction.transactionId(),
                        transaction.evseId(),
                        transaction.connectorId(),
                        TransactionStatus.ENDED,
                        transaction.startedAt(),
                        endedAt,
                        sequenceNumber
                )
        );

        recordReceipt(
                stationId,
                transactionId,
                sequenceNumber,
                TransactionEventType.ENDED
        );
    }

    private ChargingTransaction findTransactionForUpdate(
            String stationId,
            String transactionId
    ) {
        return transactionReader
                .findByIdForUpdate(
                        stationId,
                        transactionId
                )
                .orElseThrow(() ->
                        new TransactionNotFoundException(
                                stationId,
                                transactionId
                        )
                );
    }

    private boolean isAlreadyReceived(
            String stationId,
            String transactionId,
            int sequenceNumber,
            TransactionEventType receivedType
    ) {
        var existing =
                eventReceiptReader.findById(
                        stationId,
                        transactionId,
                        sequenceNumber
                );

        if (existing.isEmpty()) {
            return false;
        }

        var receipt = existing.get();

        if (receipt.eventType()
                != receivedType) {

            throw new ConflictingTransactionEventException(
                    sequenceNumber,
                    receipt.eventType(),
                    receivedType
            );
        }

        return true;
    }

    private void recordReceipt(
            String stationId,
            String transactionId,
            int sequenceNumber,
            TransactionEventType eventType
    ) {
        eventReceiptWriter.save(
                new TransactionEventReceipt(
                        stationId,
                        transactionId,
                        sequenceNumber,
                        eventType
                )
        );
    }

    private boolean isDuplicateStart(
            ChargingTransaction transaction,
            int evseId,
            int connectorId,
            Instant startedAt,
            int sequenceNumber
    ) {
        return transaction.status()
                == TransactionStatus.ACTIVE
                && transaction.lastSequenceNumber()
                == sequenceNumber
                && transaction.evseId()
                == evseId
                && transaction.connectorId()
                == connectorId
                && transaction.startedAt()
                .equals(startedAt);
    }

    private boolean isDuplicateEnd(
            ChargingTransaction transaction,
            Instant endedAt,
            int sequenceNumber
    ) {
        return transaction.status()
                == TransactionStatus.ENDED
                && transaction.lastSequenceNumber()
                == sequenceNumber
                && transaction.endedAt() != null
                && transaction.endedAt()
                .equals(endedAt);
    }

    private void ensureActive(
            ChargingTransaction transaction
    ) {
        if (transaction.status()
                != TransactionStatus.ACTIVE) {

            throw new TransactionNotActiveException(
                    transaction.stationId(),
                    transaction.transactionId()
            );
        }
    }

    private void ensureSequenceAdvances(
            ChargingTransaction transaction,
            int sequenceNumber
    ) {
        if (sequenceNumber
                <= transaction.lastSequenceNumber()) {

            throw new InvalidTransactionSequenceException(
                    transaction.lastSequenceNumber(),
                    sequenceNumber
            );
        }
    }
}