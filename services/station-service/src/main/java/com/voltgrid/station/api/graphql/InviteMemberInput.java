package com.voltgrid.station.api.graphql;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteMemberInput(
        @NotBlank(message = "organization id must not be blank")
        @Size(max = 64)
        String organizationId,

        @NotBlank(message = "user id must not be blank")
        @Size(max = 255)
        String userId,

        @NotBlank(message = "user email must not be blank")
        @Size(max = 255)
        String userEmail,

        @NotBlank(message = "role must not be blank")
        @Size(max = 64)
        String role
) {}
