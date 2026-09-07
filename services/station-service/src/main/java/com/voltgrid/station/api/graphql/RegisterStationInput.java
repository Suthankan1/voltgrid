package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterStationInput(

        @NotBlank(message = "station id must not be blank")
        @Size(max = 255, message = "station id must not exceed 255 characters")
        String id,

        @NotBlank(message = "station name must not be blank")
        @Size(max = 255, message = "station name must not exceed 255 characters")
        String name
) {
}