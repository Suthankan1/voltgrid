package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.TransactionDataStatus;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "transaction_integrity_status")
public class TransactionIntegrityStatusEntity {

    @EmbeddedId
    private ChargingTransactionId id;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "integrity_status",
            nullable = false
    )
    private TransactionDataStatus integrityStatus;

    protected TransactionIntegrityStatusEntity() {
    }

    public ChargingTransactionId getId() {
        return id;
    }

    public TransactionDataStatus getIntegrityStatus() {
        return integrityStatus;
    }
}