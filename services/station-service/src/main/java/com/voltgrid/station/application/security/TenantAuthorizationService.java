package com.voltgrid.station.application.security;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.domain.security.Role;
import com.voltgrid.station.domain.security.RolePermissions;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class TenantAuthorizationService {

    private final OrganizationMembershipJpaRepository membershipRepository;
    private final boolean requireAuth;

    public TenantAuthorizationService(
            OrganizationMembershipJpaRepository membershipRepository,
            @Value("${voltgrid.security.require-auth:false}") boolean requireAuth
    ) {
        this.membershipRepository = membershipRepository;
        this.requireAuth = requireAuth;
    }

    public void assertAuthorized(String organizationId, Permission permission) {
        var user = SecurityContext.get();

        if (user == null) {
            if (requireAuth) {
                throw new TenantAccessDeniedException("Unauthenticated access denied");
            }
            return; // In development with auth disabled, allow passthrough
        }

        // Platform administrators have global access across organizations
        if (user.roles().contains(Role.PLATFORM_ADMIN.name())) {
            return;
        }

        if (organizationId == null || organizationId.isBlank()) {
            throw new TenantAccessDeniedException("Organization context is required");
        }

        // Verify membership in target organization
        Optional<OrganizationMembershipEntity> membershipOpt =
                membershipRepository.findByOrganizationIdAndUserId(organizationId, user.userId());

        if (membershipOpt.isEmpty() || !"ACTIVE".equalsIgnoreCase(membershipOpt.get().getStatus())) {
            throw new TenantAccessDeniedException(
                    "User " + user.userId() + " is not an active member of organization " + organizationId
            );
        }

        String roleStr = membershipOpt.get().getRole();
        try {
            Role role = Role.valueOf(roleStr);
            if (!RolePermissions.hasPermission(role, permission)) {
                throw new TenantAccessDeniedException(
                        "Role " + role + " lacks required permission: " + permission.getValue()
                );
            }
        } catch (IllegalArgumentException e) {
            throw new TenantAccessDeniedException("Invalid role assigned: " + roleStr);
        }
    }

    public String resolveAuthorizedOrganizationId(String requestedOrgId) {
        var user = SecurityContext.get();
        if (user != null && user.activeOrganizationId() != null && !user.activeOrganizationId().isBlank()) {
            return user.activeOrganizationId();
        }
        if (requestedOrgId != null && !requestedOrgId.isBlank()) {
            return requestedOrgId;
        }
        return "org_voltgrid_default";
    }
}
