package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.application.StationStatusQueryService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class StationStatusGraphQlController {

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
}