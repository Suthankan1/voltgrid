package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChargingTransactionJpaRepository
        extends JpaRepository<
                ChargingTransactionEntity,
                ChargingTransactionId
        > {
}