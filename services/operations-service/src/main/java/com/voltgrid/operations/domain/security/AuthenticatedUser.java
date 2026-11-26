package com.voltgrid.operations.domain.security;

import java.util.Collections;
import java.util.Set;

public record AuthenticatedUser(
        String userId,
        String email,
        Set<String> roles,
        String activeOrganizationId
) {
    public AuthenticatedUser {
        roles = roles != null ? Collections.unmodifiableSet(roles) : Collections.emptySet();
    }
}
