package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
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

    @Override
    public List<ChargingStation> findByOrganizationId(String organizationId) {
        return repository.findAll()
                .stream()
                .filter(e -> organizationId != null && organizationId.equals(e.getOrganizationId()))
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Optional<ChargingStation> findByIdAndOrganizationId(String id, String organizationId) {
        return repository.findById(id)
                .filter(e -> organizationId != null && organizationId.equals(e.getOrganizationId()))
                .map(this::toDomain);
    }

    private ChargingStation toDomain(ChargingStationEntity entity) {
        return new ChargingStation(
                entity.getId(),
                entity.getName(),
                entity.getStatus(),
                entity.getLastSeenAt(),
                entity.getOrganizationId(),
                entity.getSiteId()
        );
    }
}
