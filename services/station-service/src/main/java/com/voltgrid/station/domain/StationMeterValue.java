package com.voltgrid.station.domain;

import java.math.BigDecimal;
import java.time.Instant;

public record StationMeterValue(
        Long id,
        String stationId,
        int evseId,
        Integer connectorId,
        String transactionId,
        Instant sampledAt,
        BigDecimal rawValue,
        BigDecimal normalizedValue,
        String measurand,
        String context,
        String phase,
        String location,
        String unit,
        int unitMultiplier
) {
}
