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

    @Column(name = "organization_id")
    private String organizationId;

    @Column(name = "site_id")
    private String siteId;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StationStatus status;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "connection_generation", nullable = false)
    private long connectionGeneration = 0L;

    @Column(name = "status_sequence_number", nullable = false)
    private long statusSequenceNumber = 0L;

    protected ChargingStationEntity() {
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status
    ) {
        this(id, name, status, null, null, null, 0L, 0L);
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt
    ) {
        this(id, name, status, lastSeenAt, null, null, 0L, 0L);
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt,
            String organizationId,
            String siteId
    ) {
        this(id, name, status, lastSeenAt, organizationId, siteId, 0L, 0L);
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status,
            Instant lastSeenAt,
            String organizationId,
            String siteId,
            long connectionGeneration,
            long statusSequenceNumber
    ) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.lastSeenAt = lastSeenAt;
        this.organizationId = organizationId;
        this.siteId = siteId;
        this.connectionGeneration = connectionGeneration;
        this.statusSequenceNumber = statusSequenceNumber;
    }

    public String getId() {
        return id;
    }

    public String getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(String organizationId) {
        this.organizationId = organizationId;
    }

    public String getSiteId() {
        return siteId;
    }

    public void setSiteId(String siteId) {
        this.siteId = siteId;
    }

    public String getName() {
        return name;
    }

    public StationStatus getStatus() {
        return status;
    }

    public void setStatus(StationStatus status) {
        this.status = status;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(Instant lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }

    public long getConnectionGeneration() {
        return connectionGeneration;
    }

    public void setConnectionGeneration(long connectionGeneration) {
        this.connectionGeneration = connectionGeneration;
    }

    public long getStatusSequenceNumber() {
        return statusSequenceNumber;
    }

    public void setStatusSequenceNumber(long statusSequenceNumber) {
        this.statusSequenceNumber = statusSequenceNumber;
    }
}
