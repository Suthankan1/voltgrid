package com.voltgrid.station.domain;

public record ChargingStation(
        String id,
        String name,
        StationStatus status
) {
}
