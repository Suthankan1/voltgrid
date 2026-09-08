package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationConnectorReader;
import com.voltgrid.station.domain.StationConnector;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class JpaStationConnectorReader
        implements StationConnectorReader {

    private final StationConnectorJpaRepository repository;

    public JpaStationConnectorReader(
            StationConnectorJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public List<StationConnector> findByStationId(
            String stationId
    ) {
        return repository
                .findByIdStationId(stationId)
                .stream()
                .map(this::toDomain)
                .sorted(
                        Comparator
                                .comparingInt(
                                        StationConnector::evseId
                                )
                                .thenComparingInt(
                                        StationConnector::connectorId
                                )
                )
                .toList();
    }

    private StationConnector toDomain(
            StationConnectorEntity entity
    ) {
        return new StationConnector(
                entity.getId().getStationId(),
                entity.getId().getEvseId(),
                entity.getId().getConnectorId(),
                entity.getStatus(),
                entity.getStatusUpdatedAt()
        );
    }
}