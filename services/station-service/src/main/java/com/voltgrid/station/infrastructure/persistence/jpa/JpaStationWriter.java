package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationWriter;
import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Component;

@Component
public class JpaStationWriter implements StationWriter {

    private final ChargingStationJpaRepository repository;

    public JpaStationWriter(ChargingStationJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public void save(ChargingStation station) {
        repository.save(
                new ChargingStationEntity(
                        station.id(),
                        station.name(),
                        station.status()
                )
        );
    }
}