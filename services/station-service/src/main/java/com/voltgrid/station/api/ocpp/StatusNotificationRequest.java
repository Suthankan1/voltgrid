package com.voltgrid.station.api.ocpp;

public record StatusNotificationRequest(
        String timestamp,
        String connectorStatus,
        Integer evseId,
        Integer connectorId
) {
}