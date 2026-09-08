package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionMeterSample;

import java.util.List;

public interface TransactionMeterSampleReader {

    List<TransactionMeterSample> findByTransaction(
            String stationId,
            String transactionId
    );
}