package com.voltgrid.station.api.graphql;

import com.voltgrid.station.domain.TransactionMeterSample;

public record TransactionMeterSampleView(
        int sequenceNumber,
        String sampledAt,
        String value,
        String measurand,
        String context,
        String phase,
        String location,
        String unit,
        int unitMultiplier
) {

    public static TransactionMeterSampleView from(
            TransactionMeterSample sample
    ) {
        return new TransactionMeterSampleView(
                sample.sequenceNumber(),
                sample.sampledAt().toString(),
                sample.value().toPlainString(),
                sample.measurand(),
                sample.context(),
                sample.phase(),
                sample.location(),
                sample.unit(),
                sample.unitMultiplier()
        );
    }
}