package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationTransactionWriter;
import com.voltgrid.station.domain.ChargingTransaction;
import org.springframework.stereotype.Component;

@Component
public class JpaStationTransactionWriter
        implements StationTransactionWriter {

    private final ChargingTransactionJpaRepository repository;

    public JpaStationTransactionWriter(
            ChargingTransactionJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public void save(
            ChargingTransaction transaction
    ) {
        repository.save(
                new ChargingTransactionEntity(
                        new ChargingTransactionId(
                                transaction.stationId(),
                                transaction.transactionId()
                        ),
                        transaction.evseId(),
                        transaction.connectorId(),
                        transaction.status(),
                        transaction.startedAt(),
                        transaction.endedAt(),
                        transaction.lastSequenceNumber()
                )
        );
    }
}