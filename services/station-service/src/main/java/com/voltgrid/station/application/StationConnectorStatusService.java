package com.voltgrid.station.application;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class StationConnectorStatusService {

    private final StationConnectorWriter connectorWriter;

    public StationConnectorStatusService(
            StationConnectorWriter connectorWriter
    ) {
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