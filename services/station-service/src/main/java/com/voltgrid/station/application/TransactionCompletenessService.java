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

        var receipts = receiptReader.findByTransaction(
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

        var receiptsByTransaction = receiptReader
                .findAll()
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

    private TransactionCompleteness calculate(
            ChargingTransaction transaction,
            List<TransactionEventReceipt> receipts
    ) {
        if (receipts.isEmpty()) {
            return unknown(transaction);
        }

        var startedReceipt = receipts
                .stream()
                .filter(receipt ->
                        receipt.eventType()
                                == TransactionEventType.STARTED
                )
                .findFirst();

        if (startedReceipt.isEmpty()) {
            return unknown(transaction);
        }

        var firstSequenceNumber =
                startedReceipt
                        .get()
                        .sequenceNumber();

        var missingSequenceNumbers =
                findMissingSequenceNumbers(
                        receipts,
                        firstSequenceNumber,
                        transaction.lastSequenceNumber()
                );

        var status = determineStatus(
                transaction,
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
                new HashSet<Integer>();

        for (var receipt : receipts) {
            receivedNumbers.add(
                    receipt.sequenceNumber()
            );
        }

        var missing =
                new ArrayList<Integer>();

        for (
                int sequenceNumber = firstSequenceNumber;
                sequenceNumber <= lastSequenceNumber;
                sequenceNumber++
        ) {
            if (!receivedNumbers.contains(
                    sequenceNumber
            )) {
                missing.add(sequenceNumber);
            }
        }

        return List.copyOf(missing);
    }

    private TransactionDataStatus determineStatus(
            ChargingTransaction transaction,
            List<Integer> missingSequenceNumbers
    ) {
        if (transaction.status()
                == TransactionStatus.ACTIVE) {

            return TransactionDataStatus.IN_PROGRESS;
        }

        if (missingSequenceNumbers.isEmpty()) {
            return TransactionDataStatus.COMPLETE;
        }

        return TransactionDataStatus.INCOMPLETE;
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

    private record TransactionKey(
            String stationId,
            String transactionId
    ) {
    }
}