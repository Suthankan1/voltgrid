package com.voltgrid.operations.messaging.idempotency;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "processed_event_receipts")
public class ProcessedEventReceiptEntity {

    @Id
    @Column(
            name = "event_id",
            nullable = false
    )
    private UUID eventId;

    @Column(
            name = "event_type",
            nullable = false,
            length = 128
    )
    private String eventType;

    @Column(
            name = "processed_at",
            nullable = false
    )
    private Instant processedAt;

    protected ProcessedEventReceiptEntity() {
    }

    public ProcessedEventReceiptEntity(
            UUID eventId,
            String eventType,
            Instant processedAt
    ) {
        this.eventId = Objects.requireNonNull(
                eventId,
                "eventId must not be null"
        );

        if (eventType == null || eventType.isBlank()) {
            throw new IllegalArgumentException(
                    "eventType must not be blank"
            );
        }

        this.eventType = eventType;

        this.processedAt = Objects.requireNonNull(
                processedAt,
                "processedAt must not be null"
        );
    }

    public UUID getEventId() {
        return eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }
}