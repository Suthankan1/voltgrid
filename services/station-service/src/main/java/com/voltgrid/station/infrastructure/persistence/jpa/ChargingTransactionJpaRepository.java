package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChargingTransactionJpaRepository
        extends JpaRepository<
                ChargingTransactionEntity,
                ChargingTransactionId
        > {

    List<ChargingTransactionEntity>
    findByIdStationIdOrderByStartedAtDesc(
            String stationId
    );
}