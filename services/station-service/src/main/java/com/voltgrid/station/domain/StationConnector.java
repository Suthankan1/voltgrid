package com.voltgrid.station.domain;

import java.time.Instant;

public record StationConnector(
        String stationId,
        int evseId,
        int connectorId,
        ConnectorStatus status,
        Instant statusUpdatedAt
) {
}