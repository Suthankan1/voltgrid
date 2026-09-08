package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class StationConnectorId implements Serializable {

    @Column(name = "station_id")
    private String stationId;

    @Column(name = "evse_id")
    private int evseId;

    @Column(name = "connector_id")
    private int connectorId;

    protected StationConnectorId() {
    }

    public StationConnectorId(
            String stationId,
            int evseId,
            int connectorId
    ) {
        this.stationId = stationId;
        this.evseId = evseId;
        this.connectorId = connectorId;
    }

    public String getStationId() {
        return stationId;
    }

    public int getEvseId() {
        return evseId;
    }

    public int getConnectorId() {
        return connectorId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }

        if (!(object instanceof StationConnectorId other)) {
            return false;
        }

        return evseId == other.evseId
                && connectorId == other.connectorId
                && Objects.equals(
                        stationId,
                        other.stationId
                );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                stationId,
                evseId,
                connectorId
        );
    }
}