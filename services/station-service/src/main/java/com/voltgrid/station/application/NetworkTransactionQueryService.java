package com.voltgrid.station.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class NetworkTransactionQueryService {

    private final StationTransactionReader transactionReader;
    private final TransactionCompletenessService completenessService;

    public NetworkTransactionQueryService(
            StationTransactionReader transactionReader,
            TransactionCompletenessService completenessService
    ) {
        this.transactionReader = transactionReader;
        this.completenessService = completenessService;
    }

    @Transactional(readOnly = true)
    public List<NetworkTransactionSnapshot> findAll() {
        var transactions =
                transactionReader.findAll();

        var completeness =
                completenessService.calculateAll(
                        transactions
                );

        var result =
                new ArrayList<NetworkTransactionSnapshot>(
                        transactions.size()
                );

        for (
                int index = 0;
                index < transactions.size();
                index++
        ) {
            result.add(
                    new NetworkTransactionSnapshot(
                            transactions.get(index),
                            completeness.get(index)
                    )
            );
        }

        return List.copyOf(result);
    }
}