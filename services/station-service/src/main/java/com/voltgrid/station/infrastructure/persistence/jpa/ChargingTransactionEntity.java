package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.TransactionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "charging_transactions")
public class ChargingTransactionEntity {

    @EmbeddedId
    private ChargingTransactionId id;

    @Column(name = "evse_id", nullable = false)
    private int evseId;

    @Column(name = "connector_id", nullable = false)
    private int connectorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TransactionStatus status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(
            name = "last_sequence_number",
            nullable = false
    )
    private int lastSequenceNumber;

    protected ChargingTransactionEntity() {
    }

    public ChargingTransactionEntity(
            ChargingTransactionId id,
            int evseId,
            int connectorId,
            TransactionStatus status,
            Instant startedAt,
            int lastSequenceNumber
    ) {
        this.id = id;
        this.evseId = evseId;
        this.connectorId = connectorId;
        this.status = status;
        this.startedAt = startedAt;
        this.lastSequenceNumber = lastSequenceNumber;
    }

    public ChargingTransactionId getId() {
        return id;
    }

    public int getEvseId() {
        return evseId;
    }

    public int getConnectorId() {
        return connectorId;
    }

    public TransactionStatus getStatus() {
        return status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public int getLastSequenceNumber() {
        return lastSequenceNumber;
    }
}