package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.StationConnectorWriter;
import com.voltgrid.station.domain.StationConnector;
import org.springframework.stereotype.Component;

@Component
public class JpaStationConnectorWriter
        implements StationConnectorWriter {

    private final StationConnectorJpaRepository repository;

    public JpaStationConnectorWriter(
            StationConnectorJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public void save(StationConnector connector) {
        repository.save(
                new StationConnectorEntity(
                        new StationConnectorId(
                                connector.stationId(),
                                connector.evseId(),
                                connector.connectorId()
                        ),
                        connector.status(),
                        connector.statusUpdatedAt()
                )
        );
    }
}