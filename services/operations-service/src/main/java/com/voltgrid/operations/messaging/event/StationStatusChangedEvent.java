package com.voltgrid.operations.messaging.event;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record StationStatusChangedEvent(
        UUID eventId,
        String stationId,
        String organizationId,
        String previousStatus,
        String currentStatus,
        Instant occurredAt,
        Long sequenceNumber
) {

    public StationStatusChangedEvent {
        Objects.requireNonNull(
                eventId,
                "eventId must not be null"
        );

        Objects.requireNonNull(
                occurredAt,
                "occurredAt must not be null"
        );

        if (stationId == null || stationId.isBlank()) {
            throw new IllegalArgumentException(
                    "stationId must not be blank"
            );
        }

        if (previousStatus == null
                || previousStatus.isBlank()) {

            throw new IllegalArgumentException(
                    "previousStatus must not be blank"
            );
        }

        if (currentStatus == null
                || currentStatus.isBlank()) {

            throw new IllegalArgumentException(
                    "currentStatus must not be blank"
            );
        }

        if (previousStatus.equals(currentStatus)) {
            throw new IllegalArgumentException(
                    "previousStatus and currentStatus must differ"
            );
        }

        if (sequenceNumber == null) {
            sequenceNumber = 0L;
        }
    }

    public StationStatusChangedEvent(
            UUID eventId,
            String stationId,
            String organizationId,
            String previousStatus,
            String currentStatus,
            Instant occurredAt
    ) {
        this(eventId, stationId, organizationId, previousStatus, currentStatus, occurredAt, 0L);
    }

    public StationStatusChangedEvent(
            UUID eventId,
            String stationId,
            String previousStatus,
            String currentStatus,
            Instant occurredAt
    ) {
        this(eventId, stationId, null, previousStatus, currentStatus, occurredAt, 0L);
    }
}
