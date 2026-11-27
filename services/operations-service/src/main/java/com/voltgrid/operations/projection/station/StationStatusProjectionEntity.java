package com.voltgrid.operations.projection.station;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "station_status_projections")
public class StationStatusProjectionEntity {

    @Id
    @Column(
            name = "station_id",
            nullable = false,
            length = 255
    )
    private String stationId;

    @Column(
            name = "organization_id",
            length = 64
    )
    private String organizationId;

    @Column(
            name = "current_status",
            nullable = false,
            length = 32
    )
    private String currentStatus;

    @Column(
            name = "last_event_id",
            nullable = false,
            unique = true
    )
    private UUID lastEventId;

    @Column(
            name = "status_changed_at",
            nullable = false
    )
    private Instant statusChangedAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    @Column(
            name = "sequence_number",
            nullable = false
    )
    private long sequenceNumber = 0L;

    protected StationStatusProjectionEntity() {
    }

    public StationStatusProjectionEntity(
            String stationId,
            String currentStatus,
            UUID lastEventId,
            Instant statusChangedAt,
            Instant updatedAt
    ) {
        this(stationId, null, currentStatus, lastEventId, statusChangedAt, updatedAt, 0L);
    }

    public StationStatusProjectionEntity(
            String stationId,
            String organizationId,
            String currentStatus,
            UUID lastEventId,
            Instant statusChangedAt,
            Instant updatedAt
    ) {
        this(stationId, organizationId, currentStatus, lastEventId, statusChangedAt, updatedAt, 0L);
    }

    public StationStatusProjectionEntity(
            String stationId,
            String organizationId,
            String currentStatus,
            UUID lastEventId,
            Instant statusChangedAt,
            Instant updatedAt,
            long sequenceNumber
    ) {
        if (stationId == null || stationId.isBlank()) {
            throw new IllegalArgumentException(
                    "stationId must not be blank"
            );
        }

        if (currentStatus == null || currentStatus.isBlank()) {
            throw new IllegalArgumentException(
                    "currentStatus must not be blank"
            );
        }

        this.stationId = stationId;
        this.organizationId = organizationId;
        this.currentStatus = currentStatus;
        this.lastEventId = Objects.requireNonNull(
                lastEventId,
                "lastEventId must not be null"
        );
        this.statusChangedAt = Objects.requireNonNull(
                statusChangedAt,
                "statusChangedAt must not be null"
        );
        this.updatedAt = Objects.requireNonNull(
                updatedAt,
                "updatedAt must not be null"
        );
        this.sequenceNumber = sequenceNumber;
    }

    public boolean apply(
            UUID eventId,
            String currentStatus,
            Instant statusChangedAt,
            Instant updatedAt
    ) {
        return apply(eventId, currentStatus, statusChangedAt, updatedAt, 0L);
    }

    public boolean apply(
            UUID eventId,
            String currentStatus,
            Instant statusChangedAt,
            Instant updatedAt,
            long sequenceNumber
    ) {
        Objects.requireNonNull(
                eventId,
                "eventId must not be null"
        );

        Objects.requireNonNull(
                statusChangedAt,
                "statusChangedAt must not be null"
        );

        Objects.requireNonNull(
                updatedAt,
                "updatedAt must not be null"
        );

        if (currentStatus == null || currentStatus.isBlank()) {
            throw new IllegalArgumentException(
                    "currentStatus must not be blank"
            );
        }

        if (eventId.equals(lastEventId)) {
            return false;
        }

        // Once a sequenced event is seen, only a higher sequence can replace it.
        if (this.sequenceNumber > 0 && sequenceNumber <= this.sequenceNumber) {
            return false;
        }
        if (sequenceNumber <= 0 && statusChangedAt.isBefore(this.statusChangedAt)) {
            return false;
        }

        this.currentStatus = currentStatus;
        this.lastEventId = eventId;
        this.statusChangedAt = statusChangedAt;
        this.updatedAt = updatedAt;
        if (sequenceNumber > 0) {
            this.sequenceNumber = sequenceNumber;
        }

        return true;
    }

    public String getStationId() {
        return stationId;
    }

    public String getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(String organizationId) {
        this.organizationId = organizationId;
    }

    public String getCurrentStatus() {
        return currentStatus;
    }

    public UUID getLastEventId() {
        return lastEventId;
    }

    public Instant getStatusChangedAt() {
        return statusChangedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public long getSequenceNumber() {
        return sequenceNumber;
    }
}
