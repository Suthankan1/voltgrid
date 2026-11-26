package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

import java.util.List;
import java.util.Optional;

public interface StationTransactionReader {

    Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    );

    Optional<ChargingTransaction> findByIdForUpdate(
            String stationId,
            String transactionId
    );

    List<ChargingTransaction> findAll();

    default PageResult<ChargingTransaction> findPage(
            int page,
            int size
    ) {
        return findPage(
                page,
                size,
                TransactionPageFilter.empty()
        );
    }

    PageResult<ChargingTransaction> findPage(
            int page,
            int size,
            TransactionPageFilter filter
    );

    List<ChargingTransaction> findByStationId(
            String stationId
    );

    default List<ChargingTransaction> findByOrganizationId(String organizationId) {
        return findPage(0, 500, new TransactionPageFilter(null, null, null, organizationId)).content();
    }

    default List<ChargingTransaction> findByStationIdAndOrganizationId(String stationId, String organizationId) {
        return findPage(0, 500, new TransactionPageFilter(stationId, null, null, organizationId)).content();
    }

    default Optional<ChargingTransaction> findByIdAndOrganizationId(String stationId, String transactionId, String organizationId) {
        return findPage(0, 1, new TransactionPageFilter(stationId, transactionId, null, organizationId))
                .content()
                .stream()
                .findFirst();
    }
}
