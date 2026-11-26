package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionMeterSample;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class StationTransactionQueryService {

    private final StationTransactionReader transactionReader;
    private final TransactionMeterSampleReader meterSampleReader;

    public StationTransactionQueryService(
            StationTransactionReader transactionReader,
            TransactionMeterSampleReader meterSampleReader
    ) {
        this.transactionReader = transactionReader;
        this.meterSampleReader = meterSampleReader;
    }

    @Transactional(readOnly = true)
    public Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    ) {
        return transactionReader.findById(
                stationId,
                transactionId
        );
    }

    @Transactional(readOnly = true)
    public Optional<ChargingTransaction> findByIdAndOrganizationId(
            String stationId,
            String transactionId,
            String organizationId
    ) {
        if (organizationId == null || organizationId.isBlank()) {
            return findById(stationId, transactionId);
        }
        return transactionReader.findByIdAndOrganizationId(
                stationId,
                transactionId,
                organizationId
        );
    }

    @Transactional(readOnly = true)
    public List<ChargingTransaction> findAll() {
        return transactionReader.findAll();
    }

    @Transactional(readOnly = true)
    public List<ChargingTransaction> findByOrganizationId(String organizationId) {
        if (organizationId == null || organizationId.isBlank()) {
            return findAll();
        }
        return transactionReader.findByOrganizationId(organizationId);
    }

    @Transactional(readOnly = true)
    public List<ChargingTransaction> findByStationId(
            String stationId
    ) {
        return transactionReader.findByStationId(
                stationId
        );
    }

    @Transactional(readOnly = true)
    public List<ChargingTransaction> findByStationIdAndOrganizationId(
            String stationId,
            String organizationId
    ) {
        if (organizationId == null || organizationId.isBlank()) {
            return findByStationId(stationId);
        }
        return transactionReader.findByStationIdAndOrganizationId(
                stationId,
                organizationId
        );
    }

    @Transactional(readOnly = true)
    public List<TransactionMeterSample> findMeterSamples(
            String stationId,
            String transactionId
    ) {
        return meterSampleReader.findByTransaction(
                stationId,
                transactionId
        );
    }

    @Transactional(readOnly = true)
    public List<TransactionMeterSample> findMeterSamplesAndOrganizationId(
            String stationId,
            String transactionId,
            String organizationId
    ) {
        if (organizationId != null && !organizationId.isBlank()) {
            var tx = findByIdAndOrganizationId(stationId, transactionId, organizationId);
            if (tx.isEmpty()) {
                return List.of();
            }
        }
        return meterSampleReader.findByTransaction(
                stationId,
                transactionId
        );
    }
}
