package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.application.StationStatusQueryService;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.data.domain.Window;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.query.ScrollSubrange;
import org.springframework.stereotype.Controller;

@Controller
public class StationStatusGraphQlController {

    private static final int DEFAULT_PAGE_SIZE =
            20;

    private final StationStatusQueryService queryService;

    public StationStatusGraphQlController(
            StationStatusQueryService queryService
    ) {
        this.queryService = queryService;
    }

    @QueryMapping
    public StationStatusView stationStatus(
            @Argument String stationId
    ) {
        return queryService.findByStationId(
                stationId
        );
    }

    @QueryMapping
    public Window<StationStatusView> stationStatuses(
            ScrollSubrange subrange
    ) {
        var position =
                subrange
                        .position()
                        .orElse(
                                ScrollPosition.keyset()
                        );

        var count =
                subrange
                        .count()
                        .orElse(
                                DEFAULT_PAGE_SIZE
                        );

        return queryService.findAll(
                position,
                count
        );
    }
}