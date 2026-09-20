package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class NetworkTransactionQueryService {

    private static final int MAX_PAGE_SIZE = 100;

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
        return combine(
                transactionReader.findAll()
        );
    }

    @Transactional(readOnly = true)
    public PageResult<NetworkTransactionSnapshot> findPage(
            int page,
            int size
    ) {
        validatePageRequest(
                page,
                size
        );

        var transactionPage =
                transactionReader.findPage(
                        page,
                        size
                );

        var content =
                combine(
                        transactionPage.content()
                );

        return new PageResult<>(
                content,
                transactionPage.page(),
                transactionPage.size(),
                transactionPage.totalElements(),
                transactionPage.totalPages(),
                transactionPage.hasNext()
        );
    }

    private List<NetworkTransactionSnapshot> combine(
            List<ChargingTransaction> transactions
    ) {
        if (transactions.isEmpty()) {
            return List.of();
        }

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

    private void validatePageRequest(
            int page,
            int size
    ) {
        if (page < 0) {
            throw new IllegalArgumentException(
                    "Page index must be zero or greater."
            );
        }

        if (size < 1
                || size > MAX_PAGE_SIZE) {

            throw new IllegalArgumentException(
                    "Page size must be between 1 and "
                            + MAX_PAGE_SIZE
                            + "."
            );
        }
    }
}