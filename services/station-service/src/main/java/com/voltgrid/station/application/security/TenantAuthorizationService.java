package com.voltgrid.station.application.security;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.domain.security.AuthenticatedUser;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.domain.security.Role;
import com.voltgrid.station.domain.security.RolePermissions;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TenantAuthorizationService {

    private final OrganizationMembershipJpaRepository membershipRepository;
    private final boolean requireAuth;
    private final OrganizationJpaRepository organizationRepository;

    @Autowired
    public TenantAuthorizationService(
            OrganizationMembershipJpaRepository membershipRepository,
            OrganizationJpaRepository organizationRepository,
            @Value("${voltgrid.security.require-auth:true}") boolean requireAuth
    ) {
        this.membershipRepository = membershipRepository;
        this.organizationRepository = organizationRepository;
        this.requireAuth = requireAuth;
    }

    public void assertAuthorized(String organizationId, Permission permission) {
        AuthenticatedUser user = SecurityContext.get();

        if (user == null) {
            if (requireAuth) {
                throw new TenantAccessDeniedException("Unauthenticated access denied");
            }
            return;
        }

        if (!RolePermissions.hasPermission(authorizedRole(organizationId), permission)) {
            throw new TenantAccessDeniedException("Organization permission denied");
        }
    }

    public Role authorizedRole(String organizationId) {
        AuthenticatedUser user = SecurityContext.get();
        if (user == null || organizationId == null || organizationId.isBlank()
                || organizationRepository.findById(organizationId)
                        .filter(org -> "ACTIVE".equals(org.getStatus())).isEmpty()) {
            throw new TenantAccessDeniedException("Active organization access required");
        }
        if (user.roles().contains(Role.PLATFORM_ADMIN.name())) {
            return Role.PLATFORM_ADMIN;
        }
        return membershipRepository.findByOrganizationIdAndUserId(organizationId, user.userId())
                .filter(membership -> "ACTIVE".equals(membership.getStatus()))
                .map(OrganizationMembershipEntity::getRole)
                .filter(role -> !Role.PLATFORM_ADMIN.name().equals(role))
                .map(TenantAuthorizationService::parseRole)
                .orElseThrow(() -> new TenantAccessDeniedException("Active organization membership required"));
    }

    private static Role parseRole(String role) {
        try {
            return Role.valueOf(role);
        } catch (IllegalArgumentException e) {
            throw new TenantAccessDeniedException("Invalid organization role");
        }
    }

    public String resolveAuthorizedOrganizationId(String requestedOrgId) {
        AuthenticatedUser user = SecurityContext.get();
        if (user == null) {
            if (requireAuth) {
                throw new TenantAccessDeniedException("Unauthenticated access denied");
            }
            return requestedOrgId != null ? requestedOrgId : "";
        }

        String organizationId = requestedOrgId != null && !requestedOrgId.isBlank()
                ? requestedOrgId : user.activeOrganizationId();
        authorizedRole(organizationId);
        return organizationId;
    }
}
