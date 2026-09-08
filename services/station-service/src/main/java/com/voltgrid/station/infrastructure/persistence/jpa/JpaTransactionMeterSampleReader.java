package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionMeterSampleReader;
import com.voltgrid.station.domain.TransactionMeterSample;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class JpaTransactionMeterSampleReader
        implements TransactionMeterSampleReader {

    private final TransactionMeterSampleJpaRepository repository;

    public JpaTransactionMeterSampleReader(
            TransactionMeterSampleJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public List<TransactionMeterSample> findByTransaction(
            String stationId,
            String transactionId
    ) {
        return repository
                .findByStationIdAndTransactionIdOrderBySampledAtAscIdAsc(
                        stationId,
                        transactionId
                )
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private TransactionMeterSample toDomain(
            TransactionMeterSampleEntity entity
    ) {
        return new TransactionMeterSample(
                entity.getStationId(),
                entity.getTransactionId(),
                entity.getSequenceNumber(),
                entity.getSampledAt(),
                entity.getValue(),
                entity.getMeasurand(),
                entity.getContext(),
                entity.getPhase(),
                entity.getLocation(),
                entity.getUnit(),
                entity.getUnitMultiplier()
        );
    }
}