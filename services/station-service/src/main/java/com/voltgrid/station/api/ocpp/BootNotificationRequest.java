package com.voltgrid.station.api.ocpp;

public record BootNotificationRequest(
        String reason,
        ChargingStationInfo chargingStation
) {

    public record ChargingStationInfo(
            String model,
            String vendorName
    ) {
    }
}