package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationTransactionQueryService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class StationTransactionGraphQlController {

    private final StationTransactionQueryService queryService;

    public StationTransactionGraphQlController(
            StationTransactionQueryService queryService
    ) {
        this.queryService = queryService;
    }

    @QueryMapping
    public List<ChargingTransactionView> stationTransactions(
            @Argument String stationId
    ) {
        return queryService
                .findByStationId(stationId)
                .stream()
                .map(ChargingTransactionView::from)
                .toList();
    }

    @QueryMapping
    public ChargingTransactionView transaction(
            @Argument String stationId,
            @Argument String transactionId
    ) {
        return queryService
                .findById(
                        stationId,
                        transactionId
                )
                .map(ChargingTransactionView::from)
                .orElse(null);
    }

    @QueryMapping
    public List<TransactionMeterSampleView> transactionMeterSamples(
            @Argument String stationId,
            @Argument String transactionId
    ) {
        return queryService
                .findMeterSamples(
                        stationId,
                        transactionId
                )
                .stream()
                .map(TransactionMeterSampleView::from)
                .toList();
    }
}