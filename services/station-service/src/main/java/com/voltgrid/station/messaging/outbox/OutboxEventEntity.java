package com.voltgrid.station.messaging.outbox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "outbox_events")
public class OutboxEventEntity {

    @Id
    private UUID id;

    @Column(
            name = "aggregate_type",
            nullable = false,
            length = 64
    )
    private String aggregateType;

    @Column(
            name = "aggregate_id",
            nullable = false,
            length = 128
    )
    private String aggregateId;

    @Column(
            name = "event_type",
            nullable = false,
            length = 128
    )
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(
            name = "payload",
            nullable = false,
            columnDefinition = "jsonb"
    )
    private String payload;

    @Column(
            name = "occurred_at",
            nullable = false
    )
    private Instant occurredAt;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "published_at"
    )
    private Instant publishedAt;

    protected OutboxEventEntity() {
    }

    public OutboxEventEntity(
            UUID id,
            String aggregateType,
            String aggregateId,
            String eventType,
            String payload,
            Instant occurredAt,
            Instant createdAt
    ) {
        this.id =
                Objects.requireNonNull(
                        id,
                        "id must not be null"
                );

        this.aggregateType =
                requireText(
                        aggregateType,
                        "aggregateType"
                );

        this.aggregateId =
                requireText(
                        aggregateId,
                        "aggregateId"
                );

        this.eventType =
                requireText(
                        eventType,
                        "eventType"
                );

        this.payload =
                requireText(
                        payload,
                        "payload"
                );

        this.occurredAt =
                Objects.requireNonNull(
                        occurredAt,
                        "occurredAt must not be null"
                );

        this.createdAt =
                Objects.requireNonNull(
                        createdAt,
                        "createdAt must not be null"
                );
    }

    public UUID getId() {
        return id;
    }

    public String getAggregateType() {
        return aggregateType;
    }

    public String getAggregateId() {
        return aggregateId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void markPublished(
            Instant publishedAt
    ) {
        this.publishedAt =
                Objects.requireNonNull(
                        publishedAt,
                        "publishedAt must not be null"
                );
    }

    private static String requireText(
            String value,
            String fieldName
    ) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    fieldName + " must not be blank"
            );
        }

        return value;
    }
}