package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionCompleteness;
import com.voltgrid.station.domain.TransactionDataStatus;
import com.voltgrid.station.domain.TransactionEventReceipt;
import com.voltgrid.station.domain.TransactionEventType;
import com.voltgrid.station.domain.TransactionStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TransactionCompletenessService {

    private final StationTransactionReader transactionReader;
    private final TransactionEventReceiptReader receiptReader;

    public TransactionCompletenessService(
            StationTransactionReader transactionReader,
            TransactionEventReceiptReader receiptReader
    ) {
        this.transactionReader = transactionReader;
        this.receiptReader = receiptReader;
    }

    @Transactional(readOnly = true)
    public TransactionCompleteness calculate(
            String stationId,
            String transactionId
    ) {
        var transaction = transactionReader
                .findById(
                        stationId,
                        transactionId
                )
                .orElseThrow(() ->
                        new TransactionNotFoundException(
                                stationId,
                                transactionId
                        )
                );

        var receipts =
                receiptReader.findByTransaction(
                        stationId,
                        transactionId
                );

        return calculate(
                transaction,
                receipts
        );
    }

    @Transactional(readOnly = true)
    public List<TransactionCompleteness> calculateAll(
            List<ChargingTransaction> transactions
    ) {
        if (transactions.isEmpty()) {
            return List.of();
        }

        var transactionKeys =
                transactions
                        .stream()
                        .map(transaction ->
                                new TransactionKey(
                                        transaction.stationId(),
                                        transaction.transactionId()
                                )
                        )
                        .toList();

        var receiptsByTransaction =
                receiptReader
                        .findByTransactions(
                                transactionKeys
                        )
                        .stream()
                        .collect(
                                Collectors.groupingBy(
                                        receipt ->
                                                new TransactionKey(
                                                        receipt.stationId(),
                                                        receipt.transactionId()
                                                )
                                )
                        );

        return transactions
                .stream()
                .map(transaction ->
                        calculate(
                                transaction,
                                receiptsByTransaction.getOrDefault(
                                        new TransactionKey(
                                                transaction.stationId(),
                                                transaction.transactionId()
                                        ),
                                        List.of()
                                )
                        )
                )
                .toList();
    }

    private static final int MAX_ENUMERATED_MISSING = 10_000;

    private TransactionCompleteness calculate(
            ChargingTransaction transaction,
            List<TransactionEventReceipt> receipts
    ) {
        var firstReceipt = receipts.stream()
                .min(Comparator.comparingInt(TransactionEventReceipt::sequenceNumber));
        if (firstReceipt.isEmpty() || firstReceipt.get().eventType() != TransactionEventType.STARTED) {
            return unknown(transaction);
        }

        int firstSequenceNumber = firstReceipt.get().sequenceNumber();
        if (firstSequenceNumber < 0 || transaction.lastSequenceNumber() < firstSequenceNumber) {
            return unknown(transaction);
        }

        boolean hasEndReceipt = receipts.stream().anyMatch(receipt ->
                receipt.sequenceNumber() == transaction.lastSequenceNumber()
                        && receipt.eventType() == TransactionEventType.ENDED);

        var missingSequenceNumbers =
                findMissingSequenceNumbers(
                        receipts,
                        firstSequenceNumber,
                        transaction.lastSequenceNumber()
                );

        var status =
                determineStatus(
                        transaction,
                        hasEndReceipt,
                        missingSequenceNumbers
                );

        return new TransactionCompleteness(
                transaction.stationId(),
                transaction.transactionId(),
                status,
                firstSequenceNumber,
                transaction.lastSequenceNumber(),
                missingSequenceNumbers
        );
    }

    private List<Integer> findMissingSequenceNumbers(
            List<TransactionEventReceipt> receipts,
            int firstSequenceNumber,
            int lastSequenceNumber
    ) {
        var receivedNumbers =
                new HashSet<Integer>(receipts.size());

        for (var receipt : receipts) {
            receivedNumbers.add(
                    receipt.sequenceNumber()
            );
        }

        var missing =
                new ArrayList<Integer>();

        for (
                int sequenceNumber =
                        firstSequenceNumber;
                sequenceNumber <=
                        lastSequenceNumber && sequenceNumber >= 0;
                sequenceNumber++
        ) {
            if (!receivedNumbers.contains(
                    sequenceNumber
            )) {
                missing.add(
                        sequenceNumber
                );
                if (missing.size() >= MAX_ENUMERATED_MISSING) {
                    break;
                }
            }
            if (sequenceNumber == Integer.MAX_VALUE) {
                break;
            }
        }

        return List.copyOf(missing);
    }

    private TransactionDataStatus determineStatus(
            ChargingTransaction transaction,
            boolean hasEndReceipt,
            List<Integer> missingSequenceNumbers
    ) {
        if (transaction.status()
                == TransactionStatus.ACTIVE) {

            return TransactionDataStatus.IN_PROGRESS;
        }

        return hasEndReceipt && missingSequenceNumbers.isEmpty()
                ? TransactionDataStatus.COMPLETE
                : TransactionDataStatus.INCOMPLETE;
    }

    private TransactionCompleteness unknown(
            ChargingTransaction transaction
    ) {
        return new TransactionCompleteness(
                transaction.stationId(),
                transaction.transactionId(),
                TransactionDataStatus.UNKNOWN,
                null,
                transaction.lastSequenceNumber(),
                List.of()
        );
    }
}