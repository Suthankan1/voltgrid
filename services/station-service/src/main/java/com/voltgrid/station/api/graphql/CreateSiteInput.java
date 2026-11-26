package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSiteInput(
        @NotBlank(message = "site id must not be blank")
        @Size(max = 64)
        String id,

        @NotBlank(message = "organization id must not be blank")
        @Size(max = 64)
        String organizationId,

        @NotBlank(message = "site name must not be blank")
        @Size(max = 255)
        String name
) {}
