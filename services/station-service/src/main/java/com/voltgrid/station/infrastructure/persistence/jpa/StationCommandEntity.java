package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.CommandStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "station_commands")
public class StationCommandEntity {

    @Id
    private UUID id;

    @Column(name = "station_id", nullable = false)
    private String stationId;

    @Column(name = "message_id", nullable = false, length = 64)
    private String messageId;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CommandStatus status;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Column(name = "response_payload", columnDefinition = "TEXT")
    private String responsePayload;

    @Column(name = "transaction_id")
    private String transactionId;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "observed_at")
    private Instant observedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected StationCommandEntity() {}

    public StationCommandEntity(
            UUID id,
            String stationId,
            String messageId,
            String action,
            CommandStatus status,
            String idempotencyKey,
            String payload,
            Instant requestedAt,
            Instant expiresAt
    ) {
        this.id = id;
        this.stationId = stationId;
        this.messageId = messageId;
        this.action = action;
        this.status = status;
        this.idempotencyKey = idempotencyKey;
        this.payload = payload;
        this.requestedAt = requestedAt;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public String getMessageId() {
        return messageId;
    }

    public String getAction() {
        return action;
    }

    public CommandStatus getStatus() {
        return status;
    }

    public void setStatus(CommandStatus status) {
        this.status = status;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getPayload() {
        return payload;
    }

    public String getResponsePayload() {
        return responsePayload;
    }

    public void setResponsePayload(String responsePayload) {
        this.responsePayload = responsePayload;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRespondedAt() {
        return respondedAt;
    }

    public void setRespondedAt(Instant respondedAt) {
        this.respondedAt = respondedAt;
    }

    public Instant getObservedAt() {
        return observedAt;
    }

    public void setObservedAt(Instant observedAt) {
        this.observedAt = observedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
