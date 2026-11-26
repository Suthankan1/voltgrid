package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProvisionCredentialInput(
        @NotBlank(message = "station id must not be blank")
        @Size(max = 255)
        String stationId,

        @NotBlank(message = "password must not be blank")
        @Size(min = 8, max = 255, message = "password must be at least 8 characters")
        String password
) {}
