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
    public List<ChargingTransaction> findByStationId(
            String stationId
    ) {
        return transactionReader.findByStationId(
                stationId
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
}