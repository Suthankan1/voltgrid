package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.ChargingStation;

import java.util.List;
import java.util.Optional;

public class JpaStationReader implements StationReader {

    private final ChargingStationJpaRepository repository;

    public JpaStationReader(ChargingStationJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<ChargingStation> findById(String id) {
        return repository.findById(id)
                .map(this::toDomain);
    }

    @Override
    public List<ChargingStation> findAll() {
        return repository.findAll()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private ChargingStation toDomain(ChargingStationEntity entity) {
        return new ChargingStation(
                entity.getId(),
                entity.getName(),
                entity.getStatus()
        );
    }
}