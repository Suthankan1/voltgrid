package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
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

    public StationTransactionService(
            StationTransactionReader transactionReader,
            StationTransactionWriter transactionWriter,
            TransactionMeterSampleWriter meterSampleWriter
    ) {
        this.transactionReader = transactionReader;
        this.transactionWriter = transactionWriter;
        this.meterSampleWriter = meterSampleWriter;
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
                        TransactionStatus.ACTIVE,
                        transaction.startedAt(),
                        null,
                        sequenceNumber
                )
        );

        if (!meterSamples.isEmpty()) {
            meterSampleWriter.saveAll(
                    meterSamples
            );
        }
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