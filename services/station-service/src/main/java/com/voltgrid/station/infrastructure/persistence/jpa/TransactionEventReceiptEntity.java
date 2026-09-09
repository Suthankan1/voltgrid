package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.TransactionEventType;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "transaction_event_receipts")
public class TransactionEventReceiptEntity {

    @EmbeddedId
    private TransactionEventReceiptId id;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "event_type",
            nullable = false
    )
    private TransactionEventType eventType;

    protected TransactionEventReceiptEntity() {
    }

    public TransactionEventReceiptEntity(
            TransactionEventReceiptId id,
            TransactionEventType eventType
    ) {
        this.id = id;
        this.eventType = eventType;
    }

    public TransactionEventReceiptId getId() {
        return id;
    }

    public TransactionEventType getEventType() {
        return eventType;
    }
}