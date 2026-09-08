package com.voltgrid.station.api.graphql;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;

public record StationConnectorView(
        int evseId,
        int connectorId,
        ConnectorStatus status,
        String statusUpdatedAt
) {

    public static StationConnectorView from(
            StationConnector connector
    ) {
        return new StationConnectorView(
                connector.evseId(),
                connector.connectorId(),
                connector.status(),
                connector.statusUpdatedAt().toString()
        );
    }
}