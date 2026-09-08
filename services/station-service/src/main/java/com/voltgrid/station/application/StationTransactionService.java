package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class StationTransactionService {

    private final StationTransactionWriter transactionWriter;

    public StationTransactionService(
            StationTransactionWriter transactionWriter
    ) {
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
                        sequenceNumber
                )
        );
    }
}