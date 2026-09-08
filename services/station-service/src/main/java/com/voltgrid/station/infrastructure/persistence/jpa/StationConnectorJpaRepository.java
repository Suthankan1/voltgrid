package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StationConnectorJpaRepository
        extends JpaRepository<
                StationConnectorEntity,
                StationConnectorId
        > {

    List<StationConnectorEntity> findByIdStationId(
            String stationId
    );
}