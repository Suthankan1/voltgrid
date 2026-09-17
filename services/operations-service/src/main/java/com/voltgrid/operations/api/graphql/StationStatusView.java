package com.voltgrid.operations.api.graphql;

public record StationStatusView(
        String stationId,
        String currentStatus,
        String lastEventId,
        String statusChangedAt,
        String updatedAt
) {
}