package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.StationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "charging_stations")
public class ChargingStationEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StationStatus status;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    protected ChargingStationEntity() {
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status
    ) {
        this(
                id,
                name,
                status,
                null
        );
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt
    ) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.lastSeenAt = lastSeenAt;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public StationStatus getStatus() {
        return status;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}