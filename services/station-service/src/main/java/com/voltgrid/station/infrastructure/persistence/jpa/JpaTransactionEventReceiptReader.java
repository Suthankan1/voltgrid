package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.TransactionEventReceiptReader;
import com.voltgrid.station.application.TransactionKey;
import com.voltgrid.station.domain.TransactionEventReceipt;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

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
    public Optional<TransactionEventReceipt> findById(
            String stationId,
            String transactionId,
            int sequenceNumber
    ) {
        return repository
                .findById(
                        new TransactionEventReceiptId(
                                stationId,
                                transactionId,
                                sequenceNumber
                        )
                )
                .map(this::toDomain);
    }

    @Override
    public List<TransactionEventReceipt> findAll() {
        return repository
                .findAll()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public List<TransactionEventReceipt> findByTransactions(
            List<TransactionKey> transactions
    ) {
        if (transactions.isEmpty()) {
            return List.of();
        }

        var transactionSet =
                Set.copyOf(transactions);

        var stationIds =
                transactions
                        .stream()
                        .map(TransactionKey::stationId)
                        .distinct()
                        .toList();

        var transactionIds =
                transactions
                        .stream()
                        .map(TransactionKey::transactionId)
                        .distinct()
                        .toList();

        return repository
                .findByIdStationIdInAndIdTransactionIdInOrderByIdStationIdAscIdTransactionIdAscIdSequenceNumberAsc(
                        stationIds,
                        transactionIds
                )
                .stream()
                .map(this::toDomain)
                .filter(receipt ->
                        transactionSet.contains(
                                new TransactionKey(
                                        receipt.stationId(),
                                        receipt.transactionId()
                                )
                        )
                )
                .toList();
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