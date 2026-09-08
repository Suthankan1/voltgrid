package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "transaction_meter_samples")
public class TransactionMeterSampleEntity {

    @Id
    @GeneratedValue(
            strategy = GenerationType.IDENTITY
    )
    private Long id;

    @Column(
            name = "station_id",
            nullable = false
    )
    private String stationId;

    @Column(
            name = "transaction_id",
            nullable = false
    )
    private String transactionId;

    @Column(
            name = "sequence_number",
            nullable = false
    )
    private int sequenceNumber;

    @Column(
            name = "sampled_at",
            nullable = false
    )
    private Instant sampledAt;

    @Column(
            name = "value",
            nullable = false,
            precision = 24,
            scale = 8
    )
    private BigDecimal value;

    @Column(name = "measurand")
    private String measurand;

    @Column(name = "context")
    private String context;

    @Column(name = "phase")
    private String phase;

    @Column(name = "location")
    private String location;

    @Column(name = "unit")
    private String unit;

    @Column(
            name = "unit_multiplier",
            nullable = false
    )
    private int unitMultiplier;

    protected TransactionMeterSampleEntity() {
    }

    public TransactionMeterSampleEntity(
            String stationId,
            String transactionId,
            int sequenceNumber,
            Instant sampledAt,
            BigDecimal value,
            String measurand,
            String context,
            String phase,
            String location,
            String unit,
            int unitMultiplier
    ) {
        this.stationId = stationId;
        this.transactionId = transactionId;
        this.sequenceNumber = sequenceNumber;
        this.sampledAt = sampledAt;
        this.value = value;
        this.measurand = measurand;
        this.context = context;
        this.phase = phase;
        this.location = location;
        this.unit = unit;
        this.unitMultiplier = unitMultiplier;
    }

    public Long getId() {
        return id;
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

    public Instant getSampledAt() {
        return sampledAt;
    }

    public BigDecimal getValue() {
        return value;
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
}