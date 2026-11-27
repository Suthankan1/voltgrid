package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MapStationInput(
        @NotBlank(message = "station id must not be blank")
        @Size(max = 255)
        String stationId,

        @NotBlank(message = "organization id must not be blank")
        @Size(max = 255)
        String organizationId,

        @Size(max = 255)
        String siteId
) {}
