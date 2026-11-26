package com.voltgrid.station.api.graphql;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.application.StationConnectorQueryService;
import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.application.security.AdministrativeAuditService;
import com.voltgrid.station.application.security.StationCredentialService;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.application.security.TenantAuthorizationService;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.domain.security.AuthenticatedUser;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.infrastructure.persistence.jpa.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MultiTenantStationGraphQlTests {

    @Mock
    private StationQueryService stationQueryService;

    @Mock
    private StationRegistrationService stationRegistrationService;

    @Mock
    private StationConnectorQueryService connectorQueryService;

    @Mock
    private TenantAuthorizationService tenantAuthorizationService;

    @Mock
    private OrganizationJpaRepository organizationRepository;

    @Mock
    private SiteJpaRepository siteRepository;

    @Mock
    private OrganizationMembershipJpaRepository membershipRepository;

    @Mock
    private StationCredentialService credentialService;

    @Mock
    private AdministrativeAuditService auditService;

    private StationGraphQlController controller;

    @BeforeEach
    void setUp() {
        controller = new StationGraphQlController(
                stationQueryService,
                stationRegistrationService,
                connectorQueryService,
                tenantAuthorizationService,
                organizationRepository,
                siteRepository,
                membershipRepository,
                credentialService,
                auditService
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void shouldQueryStationsScopedToAuthorizedOrganization() {
        String orgId = "org-ceylon-01";
        when(tenantAuthorizationService.resolveAuthorizedOrganizationId(orgId)).thenReturn(orgId);

        var st1 = new ChargingStation("STA-1", "Station 1", StationStatus.ONLINE, null, orgId, "site-1");
        var st2 = new ChargingStation("STA-2", "Station 2", StationStatus.OFFLINE, null, orgId, "site-1");
        when(stationQueryService.findByOrganizationId(orgId)).thenReturn(List.of(st1, st2));

        var result = controller.stations(orgId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).organizationId()).isEqualTo(orgId);
        verify(tenantAuthorizationService).assertAuthorized(orgId, Permission.STATION_READ);
    }

    @Test
    void shouldDenyCrossTenantQueryWhenUnauthorized() {
        String foreignOrg = "org-competitor";
        when(tenantAuthorizationService.resolveAuthorizedOrganizationId(foreignOrg)).thenReturn(foreignOrg);
        doThrow(new TenantAccessDeniedException("Cross-tenant access denied"))
                .when(tenantAuthorizationService).assertAuthorized(foreignOrg, Permission.STATION_READ);

        assertThatThrownBy(() -> controller.stations(foreignOrg))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("Cross-tenant access denied");
    }

    @Test
    void shouldRegisterStationUnderAuthorizedOrganizationAndSite() {
        String orgId = "org-ceylon-01";
        String siteId = "site-colombo";
        var input = new RegisterStationInput("STA-NEW-100", "New Fast Charger", orgId, siteId);

        when(tenantAuthorizationService.resolveAuthorizedOrganizationId(orgId)).thenReturn(orgId);
        when(siteRepository.findById(siteId)).thenReturn(Optional.of(new SiteEntity(siteId, orgId, "Colombo", "ACTIVE")));
        var created = new ChargingStation("STA-NEW-100", "New Fast Charger", StationStatus.OFFLINE, null, orgId, siteId);
        when(stationRegistrationService.register("STA-NEW-100", "New Fast Charger", orgId, siteId)).thenReturn(created);

        var result = controller.registerStation(input);

        assertThat(result.id()).isEqualTo("STA-NEW-100");
        assertThat(result.organizationId()).isEqualTo(orgId);
        assertThat(result.siteId()).isEqualTo(siteId);

        verify(tenantAuthorizationService).assertAuthorized(orgId, Permission.STATION_REGISTER);
        verify(auditService).recordEvent(
                eq("STATION_REGISTERED"),
                any(),
                eq("USER"),
                eq(orgId),
                eq("STATION"),
                eq("STA-NEW-100"),
                eq("REGISTER"),
                eq("SUCCESS"),
                isNull(),
                contains("STA-NEW-100")
        );
    }

    @Test
    void shouldProvisionStationCredentialViaMutation() {
        String stationId = "STA-100";
        String orgId = "org-ceylon-01";
        var station = new ChargingStation(stationId, "Charger", StationStatus.OFFLINE, null, orgId, null);

        when(stationQueryService.findById(stationId)).thenReturn(Optional.of(station));
        var cred = new StationCredentialEntity("cred-123", stationId, "BASIC_AUTH", "hash", "ACTIVE");
        when(credentialService.provisionCredential(eq(stationId), eq("Pass12345!"), any(), eq(orgId))).thenReturn(cred);

        var payload = controller.provisionStationCredential(new ProvisionCredentialInput(stationId, "Pass12345!"));

        assertThat(payload.credentialId()).isEqualTo("cred-123");
        assertThat(payload.stationId()).isEqualTo(stationId);
        verify(tenantAuthorizationService).assertAuthorized(orgId, Permission.CREDENTIAL_PROVISION);
    }

    @Test
    void shouldQueryAdministrativeAuditEventsScopedToOrganization() {
        String orgId = "org-ceylon-01";
        when(tenantAuthorizationService.resolveAuthorizedOrganizationId(orgId)).thenReturn(orgId);

        var event = new AdministrativeAuditEventEntity(
                "audit-1", orgId, "STATION_REGISTERED", "user-1", "USER",
                "STATION", "STA-100", "REGISTER", "SUCCESS", null, "{}"
        );
        when(auditService.findEvents(orgId, 0, 20)).thenReturn(new PageImpl<>(List.of(event)));

        var pageView = controller.administrativeAuditEvents(orgId, 0, 20);

        assertThat(pageView.content()).hasSize(1);
        assertThat(pageView.content().get(0).getOrganizationId()).isEqualTo(orgId);
        verify(tenantAuthorizationService).assertAuthorized(orgId, Permission.AUDIT_READ);
    }
}
