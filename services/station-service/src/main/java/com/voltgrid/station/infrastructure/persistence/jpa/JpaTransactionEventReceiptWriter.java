package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionEventReceiptWriter;
import com.voltgrid.station.domain.TransactionEventReceipt;
import org.springframework.stereotype.Component;

@Component
public class JpaTransactionEventReceiptWriter
        implements TransactionEventReceiptWriter {

    private final TransactionEventReceiptJpaRepository repository;

    public JpaTransactionEventReceiptWriter(
            TransactionEventReceiptJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public void save(
            TransactionEventReceipt receipt
    ) {
        repository.save(
                new TransactionEventReceiptEntity(
                        new TransactionEventReceiptId(
                                receipt.stationId(),
                                receipt.transactionId(),
                                receipt.sequenceNumber()
                        ),
                        receipt.eventType()
                )
        );
    }
}