package com.voltgrid.station.application.security;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.domain.security.AuthenticatedUser;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantAuthorizationServiceTests {

    @Mock
    private OrganizationMembershipJpaRepository membershipRepository;

    @Mock
    private OrganizationJpaRepository organizationRepository;

    private TenantAuthorizationService authService;

    @BeforeEach
    void setUp() {
        authService = new TenantAuthorizationService(membershipRepository, organizationRepository, true);
        when(organizationRepository.findById(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(call -> Optional.of(new OrganizationEntity(call.getArgument(0), "Test organization", "ACTIVE")));
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void shouldAllowPlatformAdminAccessAcrossAnyOrganization() {
        SecurityContext.set(new AuthenticatedUser(
                "platform-admin-01",
                "root@voltgrid.lk",
                Set.of("PLATFORM_ADMIN"),
                "org-any"
        ));

        assertThatNoException().isThrownBy(() ->
                authService.assertAuthorized("org-foreign-cpo", Permission.STATION_READ)
        );
    }

    @Test
    void shouldAllowOrgOwnerToRegisterStationInOwnOrganization() {
        String userId = "owner-ceylon-01";
        String orgId = "org-ceylon";

        SecurityContext.set(new AuthenticatedUser(
                userId,
                "owner@ceylon.lk",
                Set.of("ORG_OWNER"),
                orgId
        ));

        when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(new OrganizationMembershipEntity(
                        "mem-1", orgId, userId, "owner@ceylon.lk", "ORG_OWNER", "ACTIVE"
                )));

        assertThatNoException().isThrownBy(() ->
                authService.assertAuthorized(orgId, Permission.STATION_REGISTER)
        );
    }

    @Test
    void shouldDenyCrossTenantAccessWhenUserNotInOrganization() {
        String userId = "operator-org-a";
        String orgA = "org-a";
        String orgB = "org-b";

        SecurityContext.set(new AuthenticatedUser(
                userId,
                "op@org-a.lk",
                Set.of("OPERATOR"),
                orgA
        ));

        when(membershipRepository.findByOrganizationIdAndUserId(orgB, userId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.assertAuthorized(orgB, Permission.STATION_READ))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("Active organization membership required");
    }

    @Test
    void shouldDenyAccessWhenMembershipIsRevoked() {
        String userId = "revoked-user";
        String orgId = "org-a";

        SecurityContext.set(new AuthenticatedUser(
                userId,
                "revoked@org-a.lk",
                Set.of("OPERATOR"),
                orgId
        ));

        when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(new OrganizationMembershipEntity(
                        "mem-1", orgId, userId, "revoked@org-a.lk", "OPERATOR", "REVOKED"
                )));

        assertThatThrownBy(() -> authService.assertAuthorized(orgId, Permission.STATION_READ))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("Active organization membership required");
    }

    @Test
    void shouldDenyAccessWhenRoleLacksRequiredPermission() {
        String userId = "operator-user";
        String orgId = "org-a";

        SecurityContext.set(new AuthenticatedUser(
                userId,
                "operator@org-a.lk",
                Set.of("OPERATOR"),
                orgId
        ));

        when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(new OrganizationMembershipEntity(
                        "mem-1", orgId, userId, "operator@org-a.lk", "OPERATOR", "ACTIVE"
                )));

        // Operators cannot rotate credentials or manage org
        assertThatThrownBy(() -> authService.assertAuthorized(orgId, Permission.CREDENTIAL_ROTATE))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("Organization permission denied");
    }
}
