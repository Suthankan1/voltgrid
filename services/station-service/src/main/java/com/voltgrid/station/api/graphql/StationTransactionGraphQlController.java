package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionQueryService;
import com.voltgrid.station.application.StationTransactionQueryService;
import com.voltgrid.station.application.TransactionCompletenessService;
import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.domain.TransactionDataStatus;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class StationTransactionGraphQlController {

    private final StationTransactionQueryService queryService;
    private final TransactionCompletenessService completenessService;
    private final NetworkTransactionQueryService networkTransactionQueryService;

    public StationTransactionGraphQlController(
            StationTransactionQueryService queryService,
            TransactionCompletenessService completenessService,
            NetworkTransactionQueryService networkTransactionQueryService
    ) {
        this.queryService = queryService;
        this.completenessService = completenessService;
        this.networkTransactionQueryService =
                networkTransactionQueryService;
    }

    private static final int MAX_UNPAGINATED_LIMIT = 500;
    private static final int MAX_PAGE_SIZE = 100;

    @QueryMapping
    public List<ChargingTransactionView> transactions() {
        return queryService
                .findAll()
                .stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(ChargingTransactionView::from)
                .toList();
    }

    @QueryMapping
    public List<NetworkTransactionView> networkTransactions() {
        return networkTransactionQueryService
                .findAll()
                .stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(NetworkTransactionView::from)
                .toList();
    }

    @QueryMapping
    public NetworkTransactionPageView networkTransactionPage(
            @Argument int page,
            @Argument int size,
            @Argument String stationId,
            @Argument String transactionId,
            @Argument TransactionDataStatus integrityStatus
    ) {
        int boundedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        int boundedPage = Math.max(0, page);

        return NetworkTransactionPageView.from(
                networkTransactionQueryService.findPage(
                        boundedPage,
                        boundedSize,
                        new TransactionPageFilter(
                                stationId,
                                transactionId,
                                integrityStatus
                        )
                )
        );
    }

    @QueryMapping
    public List<ChargingTransactionView> stationTransactions(
            @Argument String stationId
    ) {
        return queryService
                .findByStationId(stationId)
                .stream()
                .limit(MAX_UNPAGINATED_LIMIT)
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
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(TransactionMeterSampleView::from)
                .toList();
    }

    @QueryMapping
    public TransactionCompletenessView transactionCompleteness(
            @Argument String stationId,
            @Argument String transactionId
    ) {
        return TransactionCompletenessView.from(
                completenessService.calculate(
                        stationId,
                        transactionId
                )
        );
    }
}