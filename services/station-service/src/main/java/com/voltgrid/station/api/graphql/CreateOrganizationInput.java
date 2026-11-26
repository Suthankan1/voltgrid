package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateOrganizationInput(
        @NotBlank(message = "organization id must not be blank")
        @Size(max = 64)
        String id,

        @NotBlank(message = "organization name must not be blank")
        @Size(max = 255)
        String name
) {}
