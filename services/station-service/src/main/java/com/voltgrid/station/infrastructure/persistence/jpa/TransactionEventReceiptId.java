package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class TransactionEventReceiptId
        implements Serializable {

    @Column(name = "station_id")
    private String stationId;

    @Column(name = "transaction_id")
    private String transactionId;

    @Column(name = "sequence_number")
    private int sequenceNumber;

    protected TransactionEventReceiptId() {
    }

    public TransactionEventReceiptId(
            String stationId,
            String transactionId,
            int sequenceNumber
    ) {
        this.stationId = stationId;
        this.transactionId = transactionId;
        this.sequenceNumber = sequenceNumber;
    }

    public String getStationId() {
        return stationId;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public int getSequenceNumber() {
        return sequenceNumber;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }

        if (!(object instanceof TransactionEventReceiptId other)) {
            return false;
        }

        return sequenceNumber == other.sequenceNumber
                && Objects.equals(
                        stationId,
                        other.stationId
                )
                && Objects.equals(
                        transactionId,
                        other.transactionId
                );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                stationId,
                transactionId,
                sequenceNumber
        );
    }
}