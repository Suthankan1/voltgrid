package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionMeterSample;

import java.util.List;

public interface TransactionMeterSampleWriter {

    void saveAll(
            List<TransactionMeterSample> samples
    );
}