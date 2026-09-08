package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionMeterSampleJpaRepository
        extends JpaRepository<
                TransactionMeterSampleEntity,
                Long
        > {

    List<TransactionMeterSampleEntity>
    findByStationIdAndTransactionIdOrderBySampledAtAscIdAsc(
            String stationId,
            String transactionId
    );
}