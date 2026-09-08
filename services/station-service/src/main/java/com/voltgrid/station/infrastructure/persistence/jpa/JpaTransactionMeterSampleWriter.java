package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionMeterSampleWriter;
import com.voltgrid.station.domain.TransactionMeterSample;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class JpaTransactionMeterSampleWriter
        implements TransactionMeterSampleWriter {

    private final TransactionMeterSampleJpaRepository repository;

    public JpaTransactionMeterSampleWriter(
            TransactionMeterSampleJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public void saveAll(
            List<TransactionMeterSample> samples
    ) {
        var entities = samples
                .stream()
                .map(this::toEntity)
                .toList();

        repository.saveAll(entities);
    }

    private TransactionMeterSampleEntity toEntity(
            TransactionMeterSample sample
    ) {
        return new TransactionMeterSampleEntity(
                sample.stationId(),
                sample.transactionId(),
                sample.sequenceNumber(),
                sample.sampledAt(),
                sample.value(),
                sample.measurand(),
                sample.context(),
                sample.phase(),
                sample.location(),
                sample.unit(),
                sample.unitMultiplier()
        );
    }
}