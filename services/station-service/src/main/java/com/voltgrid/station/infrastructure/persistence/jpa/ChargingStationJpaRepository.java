package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChargingStationJpaRepository
        extends JpaRepository<ChargingStationEntity, String> {
}