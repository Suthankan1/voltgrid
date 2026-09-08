package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.ConnectorStatus;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "station_connectors")
public class StationConnectorEntity {

    @EmbeddedId
    private StationConnectorId id;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ConnectorStatus status;

    @Column(
            name = "status_updated_at",
            nullable = false
    )
    private Instant statusUpdatedAt;

    protected StationConnectorEntity() {
    }

    public StationConnectorEntity(
            StationConnectorId id,
            ConnectorStatus status,
            Instant statusUpdatedAt
    ) {
        this.id = id;
        this.status = status;
        this.statusUpdatedAt = statusUpdatedAt;
    }

    public StationConnectorId getId() {
        return id;
    }

    public ConnectorStatus getStatus() {
        return status;
    }

    public Instant getStatusUpdatedAt() {
        return statusUpdatedAt;
    }
}