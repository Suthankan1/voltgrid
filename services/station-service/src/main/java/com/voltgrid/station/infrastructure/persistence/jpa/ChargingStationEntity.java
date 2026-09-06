package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.StationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "charging_stations")
public class ChargingStationEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StationStatus status;

    protected ChargingStationEntity() {
    }

    public ChargingStationEntity(
            String id,
            String name,
            StationStatus status
    ) {
        this.id = id;
        this.name = name;
        this.status = status;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public StationStatus getStatus() {
        return status;
    }
}