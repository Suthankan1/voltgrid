package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "station_meter_values")
public class StationMeterValueEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_id", nullable = false)
    private String stationId;

    @Column(name = "evse_id", nullable = false)
    private int evseId;

    @Column(name = "connector_id")
    private Integer connectorId;

    @Column(name = "transaction_id")
    private String transactionId;

    @Column(name = "sampled_at", nullable = false)
    private Instant sampledAt;

    @Column(name = "raw_value", nullable = false, precision = 24, scale = 8)
    private BigDecimal rawValue;

    @Column(name = "normalized_value", nullable = false, precision = 24, scale = 8)
    private BigDecimal normalizedValue;

    @Column(name = "measurand", nullable = false, length = 128)
    private String measurand;

    @Column(name = "context", length = 64)
    private String context;

    @Column(name = "phase", length = 32)
    private String phase;

    @Column(name = "location", length = 64)
    private String location;

    @Column(name = "unit", length = 64)
    private String unit;

    @Column(name = "unit_multiplier", nullable = false)
    private int unitMultiplier;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected StationMeterValueEntity() {}

    public StationMeterValueEntity(
            String stationId,
            int evseId,
            Integer connectorId,
            String transactionId,
            Instant sampledAt,
            BigDecimal rawValue,
            BigDecimal normalizedValue,
            String measurand,
            String context,
            String phase,
            String location,
            String unit,
            int unitMultiplier
    ) {
        this.stationId = stationId;
        this.evseId = evseId;
        this.connectorId = connectorId;
        this.transactionId = transactionId;
        this.sampledAt = sampledAt;
        this.rawValue = rawValue;
        this.normalizedValue = normalizedValue;
        this.measurand = measurand != null ? measurand : "Energy.Active.Import.Register";
        this.context = context != null ? context : "Sample.Periodic";
        this.phase = phase;
        this.location = location != null ? location : "Outlet";
        this.unit = unit != null ? unit : "Wh";
        this.unitMultiplier = unitMultiplier;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getStationId() {
        return stationId;
    }

    public int getEvseId() {
        return evseId;
    }

    public Integer getConnectorId() {
        return connectorId;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public Instant getSampledAt() {
        return sampledAt;
    }

    public BigDecimal getRawValue() {
        return rawValue;
    }

    public BigDecimal getNormalizedValue() {
        return normalizedValue;
    }

    public String getMeasurand() {
        return measurand;
    }

    public String getContext() {
        return context;
    }

    public String getPhase() {
        return phase;
    }

    public String getLocation() {
        return location;
    }

    public String getUnit() {
        return unit;
    }

    public int getUnitMultiplier() {
        return unitMultiplier;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
