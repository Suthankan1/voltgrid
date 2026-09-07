package com.voltgrid.station.domain;

import java.time.Instant;

public record ChargingStation(
        String id,
        String name,
        StationStatus status,
        Instant lastSeenAt
) {

    public ChargingStation(
            String id,
            String name,
            StationStatus status
    ) {
        this(id, name, status, null);
    }
}