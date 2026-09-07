package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.domain.ChargingStation;
import jakarta.validation.Valid;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class StationGraphQlController {

    private final StationQueryService stationQueryService;
    private final StationRegistrationService stationRegistrationService;

    public StationGraphQlController(
            StationQueryService stationQueryService,
            StationRegistrationService stationRegistrationService
    ) {
        this.stationQueryService = stationQueryService;
        this.stationRegistrationService = stationRegistrationService;
    }

    @QueryMapping
    public List<ChargingStation> stations() {
        return stationQueryService.findAll();
    }

    @QueryMapping
    public ChargingStation station(@Argument String id) {
        return stationQueryService.findById(id)
                .orElse(null);
    }

    @MutationMapping
    public ChargingStation registerStation(
            @Argument @Valid RegisterStationInput input
    ) {
        return stationRegistrationService.register(
                input.id(),
                input.name()
        );
    }
}