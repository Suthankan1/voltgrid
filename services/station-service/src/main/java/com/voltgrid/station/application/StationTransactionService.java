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
        var existing = transactionReader.findById(
                stationId,
                transactionId
        );

        if (existing.isPresent()) {
            var transaction = existing.get();

            if (isDuplicateStart(
                    transaction,
                    evseId,
                    connectorId,
                    startedAt,
                    sequenceNumber
            )) {
                return;
            }

            throw new InvalidTransactionSequenceException(
                    transaction.lastSequenceNumber(),
                    sequenceNumber
            );
        }

        transactionWriter.save(
                new ChargingTransaction(
                        stationId,
                        transactionId,
                        evseId,
                        connectorId,
                        TransactionStatus.ACTIVE,
                        startedAt,
                        null,
                        sequenceNumber
                )
        );

        recordReceipt(
                stationId,
                transactionId,
                sequenceNumber,
                TransactionEventType.STARTED
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
                findTransaction(
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
         * A sequence number greater than the current maximum is a
         * forward event and therefore advances transaction state.
         *
         * A smaller sequence number with no existing receipt is a
         * legitimate late/out-of-order event. In that case we persist
         * its data and receipt without moving lastSequenceNumber
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
                findTransaction(
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

    private ChargingTransaction findTransaction(
            String stationId,
            String transactionId
    ) {
        return transactionReader
                .findById(
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