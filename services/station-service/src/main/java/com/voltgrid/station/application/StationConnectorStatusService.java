package com.voltgrid.station.application;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class StationConnectorStatusService {

    private final StationConnectorReader connectorReader;
    private final StationConnectorWriter connectorWriter;

    public StationConnectorStatusService(
            StationConnectorReader connectorReader,
            StationConnectorWriter connectorWriter
    ) {
        this.connectorReader = connectorReader;
        this.connectorWriter = connectorWriter;
    }

    @Transactional
    public void updateStatus(
            String stationId,
            int evseId,
            int connectorId,
            ConnectorStatus status,
            Instant statusUpdatedAt
    ) {
        var existing = connectorReader.findByStationId(stationId)
                .stream()
                .filter(c -> c.evseId() == evseId && c.connectorId() == connectorId)
                .findFirst();

        if (existing.isPresent() && existing.get().statusUpdatedAt() != null) {
            if (statusUpdatedAt.isBefore(existing.get().statusUpdatedAt())) {
                return;
            }
        }

        connectorWriter.save(
                new StationConnector(
                        stationId,
                        evseId,
                        connectorId,
                        status,
                        statusUpdatedAt
                )
        );
    }
}