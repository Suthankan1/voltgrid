package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionEventReceiptReader;
import com.voltgrid.station.domain.TransactionEventReceipt;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class JpaTransactionEventReceiptReader
        implements TransactionEventReceiptReader {

    private final TransactionEventReceiptJpaRepository repository;

    public JpaTransactionEventReceiptReader(
            TransactionEventReceiptJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public List<TransactionEventReceipt> findByTransaction(
            String stationId,
            String transactionId
    ) {
        return repository
                .findByIdStationIdAndIdTransactionIdOrderByIdSequenceNumberAsc(
                        stationId,
                        transactionId
                )
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private TransactionEventReceipt toDomain(
            TransactionEventReceiptEntity entity
    ) {
        return new TransactionEventReceipt(
                entity.getId().getStationId(),
                entity.getId().getTransactionId(),
                entity.getId().getSequenceNumber(),
                entity.getEventType()
        );
    }
}