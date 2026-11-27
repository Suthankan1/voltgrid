package com.voltgrid.station.api.ocpp;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MeterValuesRequest(
        Integer evseId,
        List<TransactionEventRequest.MeterValue> meterValue
) {
}
