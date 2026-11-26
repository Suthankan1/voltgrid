package com.voltgrid.station.domain;

import java.time.Instant;

public record ChargingStation(
        String id,
        String name,
        StationStatus status,
        Instant lastSeenAt,
        String organizationId,
        String siteId
) {

    public ChargingStation(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt
    ) {
        this(id, name, status, lastSeenAt, null, null);
    }

    public ChargingStation(
            String id,
            String name,
            StationStatus status
    ) {
        this(id, name, status, null, null, null);
    }
}
