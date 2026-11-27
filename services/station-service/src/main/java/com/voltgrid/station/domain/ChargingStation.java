package com.voltgrid.station.domain;

import java.time.Instant;

public record ChargingStation(
        String id,
        String name,
        StationStatus status,
        Instant lastSeenAt,
        String organizationId,
        String siteId,
        long connectionGeneration,
        long statusSequenceNumber
) {

    public ChargingStation(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt,
            String organizationId,
            String siteId
    ) {
        this(id, name, status, lastSeenAt, organizationId, siteId, 0L, 0L);
    }

    public ChargingStation(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt
    ) {
        this(id, name, status, lastSeenAt, null, null, 0L, 0L);
    }

    public ChargingStation(
            String id,
            String name,
            StationStatus status
    ) {
        this(id, name, status, null, null, null, 0L, 0L);
    }
}
