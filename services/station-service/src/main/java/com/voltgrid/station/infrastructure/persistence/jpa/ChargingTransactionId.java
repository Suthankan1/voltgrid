package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class ChargingTransactionId
        implements Serializable {

    @Column(name = "station_id")
    private String stationId;

    @Column(name = "transaction_id")
    private String transactionId;

    protected ChargingTransactionId() {
    }

    public ChargingTransactionId(
            String stationId,
            String transactionId
    ) {
        this.stationId = stationId;
        this.transactionId = transactionId;
    }

    public String getStationId() {
        return stationId;
    }

    public String getTransactionId() {
        return transactionId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }

        if (!(object instanceof ChargingTransactionId other)) {
            return false;
        }

        return Objects.equals(
                stationId,
                other.stationId
        ) && Objects.equals(
                transactionId,
                other.transactionId
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                stationId,
                transactionId
        );
    }
}