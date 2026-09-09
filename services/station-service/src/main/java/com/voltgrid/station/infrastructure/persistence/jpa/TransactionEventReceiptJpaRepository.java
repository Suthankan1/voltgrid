package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionEventReceiptJpaRepository
        extends JpaRepository<
                TransactionEventReceiptEntity,
                TransactionEventReceiptId
        > {

    List<TransactionEventReceiptEntity>
    findByIdStationIdAndIdTransactionIdOrderByIdSequenceNumberAsc(
            String stationId,
            String transactionId
    );
}