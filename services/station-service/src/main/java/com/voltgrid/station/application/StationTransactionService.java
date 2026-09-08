package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class StationTransactionService {

    private final StationTransactionReader transactionReader;
    private final StationTransactionWriter transactionWriter;

    public StationTransactionService(
            StationTransactionReader transactionReader,
            StationTransactionWriter transactionWriter
    ) {
        this.transactionReader = transactionReader;
        this.transactionWriter = transactionWriter;
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
    public void endTransaction(
            String stationId,
            String transactionId,
            Instant endedAt,
            int sequenceNumber
    ) {
        var transaction =
                transactionReader
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

        if (sequenceNumber
                <= transaction.lastSequenceNumber()) {

            throw new InvalidTransactionSequenceException(
                    transaction.lastSequenceNumber(),
                    sequenceNumber
            );
        }

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
}