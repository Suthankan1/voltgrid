package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationTransactionReader;
import com.voltgrid.station.domain.ChargingTransaction;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class JpaStationTransactionReader
        implements StationTransactionReader {

    private final ChargingTransactionJpaRepository repository;

    public JpaStationTransactionReader(
            ChargingTransactionJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    ) {
        return repository
                .findById(
                        new ChargingTransactionId(
                                stationId,
                                transactionId
                        )
                )
                .map(this::toDomain);
    }

    @Override
    public Optional<ChargingTransaction> findByIdForUpdate(
            String stationId,
            String transactionId
    ) {
        return repository
                .findByIdForUpdate(
                        stationId,
                        transactionId
                )
                .map(this::toDomain);
    }

    @Override
    public List<ChargingTransaction> findByStationId(
            String stationId
    ) {
        return repository
                .findByIdStationIdOrderByStartedAtDesc(
                        stationId
                )
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private ChargingTransaction toDomain(
            ChargingTransactionEntity entity
    ) {
        return new ChargingTransaction(
                entity.getId().getStationId(),
                entity.getId().getTransactionId(),
                entity.getEvseId(),
                entity.getConnectorId(),
                entity.getStatus(),
                entity.getStartedAt(),
                entity.getEndedAt(),
                entity.getLastSequenceNumber()
        );
    }
}