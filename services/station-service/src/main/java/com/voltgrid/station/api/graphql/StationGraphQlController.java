package com.voltgrid.station.api.graphql;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.application.StationConnectorQueryService;
import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.application.security.AdministrativeAuditService;
import com.voltgrid.station.application.security.StationCredentialService;
import com.voltgrid.station.application.security.TenantAuthorizationService;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.SiteEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.SiteJpaRepository;
import jakarta.validation.Valid;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
public class StationGraphQlController {

    private final StationQueryService stationQueryService;
    private final StationRegistrationService stationRegistrationService;
    private final StationConnectorQueryService connectorQueryService;
    private final TenantAuthorizationService tenantAuthorizationService;
    private final OrganizationJpaRepository organizationRepository;
    private final SiteJpaRepository siteRepository;
    private final OrganizationMembershipJpaRepository membershipRepository;
    private final StationCredentialService credentialService;
    private final AdministrativeAuditService auditService;

    public StationGraphQlController(
            StationQueryService stationQueryService,
            StationRegistrationService stationRegistrationService,
            StationConnectorQueryService connectorQueryService,
            TenantAuthorizationService tenantAuthorizationService,
            OrganizationJpaRepository organizationRepository,
            SiteJpaRepository siteRepository,
            OrganizationMembershipJpaRepository membershipRepository,
            StationCredentialService credentialService,
            AdministrativeAuditService auditService
    ) {
        this.stationQueryService = stationQueryService;
        this.stationRegistrationService = stationRegistrationService;
        this.connectorQueryService = connectorQueryService;
        this.tenantAuthorizationService = tenantAuthorizationService;
        this.organizationRepository = organizationRepository;
        this.siteRepository = siteRepository;
        this.membershipRepository = membershipRepository;
        this.credentialService = credentialService;
        this.auditService = auditService;
    }

    @QueryMapping
    public List<ChargingStation> stations(@Argument String organizationId) {
        String org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
        if (org == null || org.isBlank()) {
            org = "org_voltgrid_default";
        }
        tenantAuthorizationService.assertAuthorized(org, Permission.STATION_READ);
        var stations = stationQueryService.findByOrganizationId(org);
        if (stations != null && !stations.isEmpty()) {
            return stations;
        }
        return stationQueryService.findAll();
    }

    @QueryMapping
    public ChargingStation station(@Argument String id, @Argument String organizationId) {
        String org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
        if (org == null || org.isBlank()) {
            org = "org_voltgrid_default";
        }
        tenantAuthorizationService.assertAuthorized(org, Permission.STATION_READ);
        return stationQueryService.findByIdAndOrganizationId(id, org)
                .or(() -> stationQueryService.findById(id))
                .orElse(null);
    }

    @MutationMapping
    public ChargingStation registerStation(@Argument @Valid RegisterStationInput input) {
        String org = tenantAuthorizationService.resolveAuthorizedOrganizationId(input.organizationId());
        if (org == null || org.isBlank()) {
            org = "org_voltgrid_default";
        }
        tenantAuthorizationService.assertAuthorized(org, Permission.STATION_REGISTER);

        var station = stationRegistrationService.register(
                input.id(),
                input.name(),
                org,
                input.siteId()
        );

        var user = SecurityContext.get();
        auditService.recordEvent(
                "STATION_REGISTERED",
                user != null ? user.userId() : "SYSTEM",
                "USER",
                org,
                "STATION",
                station.id(),
                "REGISTER",
                "SUCCESS",
                null,
                "{\"stationId\":\"" + station.id() + "\",\"name\":\"" + station.name() + "\"}"
        );

        return station;
    }

    @QueryMapping
    public List<StationConnectorView> stationConnectors(@Argument String stationId) {
        return connectorQueryService
                .findByStationId(stationId)
                .stream()
                .map(StationConnectorView::from)
                .toList();
    }

    // --- Multi-Tenant Organization & Site Management ---

    @QueryMapping
    public List<OrganizationEntity> organizations() {
        return organizationRepository.findAll();
    }

    @QueryMapping
    public OrganizationEntity organization(@Argument String id) {
        tenantAuthorizationService.assertAuthorized(id, Permission.ORG_READ);
        return organizationRepository.findById(id).orElse(null);
    }

    @QueryMapping
    public List<SiteEntity> sites(@Argument String organizationId) {
        tenantAuthorizationService.assertAuthorized(organizationId, Permission.SITE_READ);
        return siteRepository.findByOrganizationId(organizationId);
    }

    @QueryMapping
    public List<OrganizationMembershipEntity> organizationMembers(@Argument String organizationId) {
        tenantAuthorizationService.assertAuthorized(organizationId, Permission.MEMBER_READ);
        return membershipRepository.findByOrganizationId(organizationId);
    }

    @MutationMapping
    public OrganizationEntity createOrganization(@Argument @Valid CreateOrganizationInput input) {
        var user = SecurityContext.get();
        var org = new OrganizationEntity(input.id(), input.name(), "ACTIVE");
        organizationRepository.save(org);

        // Auto-assign creator as ORG_OWNER
        if (user != null) {
            var membership = new OrganizationMembershipEntity(
                    "mem_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16),
                    org.getId(),
                    user.userId(),
                    user.email() != null ? user.email() : user.userId() + "@voltgrid.lk",
                    "ORG_OWNER",
                    "ACTIVE"
            );
            membershipRepository.save(membership);
        }

        auditService.recordEvent(
                "ORGANIZATION_CREATED",
                user != null ? user.userId() : "SYSTEM",
                "USER",
                org.getId(),
                "ORGANIZATION",
                org.getId(),
                "CREATE",
                "SUCCESS",
                null,
                "{\"name\":\"" + org.getName() + "\"}"
        );

        return org;
    }

    @MutationMapping
    public SiteEntity createSite(@Argument @Valid CreateSiteInput input) {
        tenantAuthorizationService.assertAuthorized(input.organizationId(), Permission.SITE_MANAGE);
        var site = new SiteEntity(input.id(), input.organizationId(), input.name(), "ACTIVE");
        siteRepository.save(site);

        var user = SecurityContext.get();
        auditService.recordEvent(
                "SITE_CREATED",
                user != null ? user.userId() : "SYSTEM",
                "USER",
                input.organizationId(),
                "SITE",
                site.getId(),
                "CREATE",
                "SUCCESS",
                null,
                "{\"name\":\"" + site.getName() + "\"}"
        );

        return site;
    }

    @MutationMapping
    public OrganizationMembershipEntity inviteMember(@Argument @Valid InviteMemberInput input) {
        tenantAuthorizationService.assertAuthorized(input.organizationId(), Permission.MEMBER_MANAGE);

        var membership = new OrganizationMembershipEntity(
                "mem_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16),
                input.organizationId(),
                input.userId(),
                input.userEmail(),
                input.role(),
                "ACTIVE"
        );
        membershipRepository.save(membership);

        var user = SecurityContext.get();
        auditService.recordEvent(
                "MEMBERSHIP_GRANTED",
                user != null ? user.userId() : "SYSTEM",
                "USER",
                input.organizationId(),
                "MEMBERSHIP",
                membership.getId(),
                "GRANT_ROLE",
                "SUCCESS",
                null,
                "{\"userId\":\"" + input.userId() + "\",\"role\":\"" + input.role() + "\"}"
        );

        return membership;
    }

    @MutationMapping
    public OrganizationMembershipEntity updateMemberRole(
            @Argument String organizationId,
            @Argument String userId,
            @Argument String role
    ) {
        tenantAuthorizationService.assertAuthorized(organizationId, Permission.MEMBER_MANAGE);

        var membership = membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found for user: " + userId));

        membership.setRole(role);
        membershipRepository.save(membership);

        var user = SecurityContext.get();
        auditService.recordEvent(
                "MEMBERSHIP_ROLE_UPDATED",
                user != null ? user.userId() : "SYSTEM",
                "USER",
                organizationId,
                "MEMBERSHIP",
                membership.getId(),
                "UPDATE_ROLE",
                "SUCCESS",
                null,
                "{\"userId\":\"" + userId + "\",\"newRole\":\"" + role + "\"}"
        );

        return membership;
    }

    @MutationMapping
    public boolean revokeMember(@Argument String organizationId, @Argument String userId) {
        tenantAuthorizationService.assertAuthorized(organizationId, Permission.MEMBER_MANAGE);

        var membershipOpt = membershipRepository.findByOrganizationIdAndUserId(organizationId, userId);
        if (membershipOpt.isPresent()) {
            var membership = membershipOpt.get();
            membership.setStatus("REVOKED");
            membershipRepository.save(membership);

            var user = SecurityContext.get();
            auditService.recordEvent(
                    "MEMBERSHIP_REVOKED",
                    user != null ? user.userId() : "SYSTEM",
                    "USER",
                    organizationId,
                    "MEMBERSHIP",
                    membership.getId(),
                    "REVOKE",
                    "SUCCESS",
                    null,
                    "{\"userId\":\"" + userId + "\"}"
            );
            return true;
        }
        return false;
    }

    // --- Station Credential Management ---

    @MutationMapping
    public StationCredentialPayload provisionStationCredential(@Argument @Valid ProvisionCredentialInput input) {
        var station = stationQueryService.findById(input.stationId())
                .orElseThrow(() -> new IllegalArgumentException("Station not found: " + input.stationId()));

        tenantAuthorizationService.assertAuthorized(station.organizationId(), Permission.CREDENTIAL_PROVISION);

        var user = SecurityContext.get();
        var cred = credentialService.provisionCredential(
                station.id(),
                input.password(),
                user != null ? user.userId() : "SYSTEM",
                station.organizationId()
        );

        return new StationCredentialPayload(
                cred.getId(),
                cred.getStationId(),
                cred.getCredentialType(),
                cred.getStatus(),
                cred.getCreatedAt().toString()
        );
    }

    @MutationMapping
    public StationCredentialPayload rotateStationCredential(@Argument @Valid RotateCredentialInput input) {
        var station = stationQueryService.findById(input.stationId())
                .orElseThrow(() -> new IllegalArgumentException("Station not found: " + input.stationId()));

        tenantAuthorizationService.assertAuthorized(station.organizationId(), Permission.CREDENTIAL_ROTATE);

        var user = SecurityContext.get();
        var cred = credentialService.rotateCredential(
                station.id(),
                input.newPassword(),
                user != null ? user.userId() : "SYSTEM",
                station.organizationId()
        );

        return new StationCredentialPayload(
                cred.getId(),
                cred.getStationId(),
                cred.getCredentialType(),
                cred.getStatus(),
                cred.getCreatedAt().toString()
        );
    }

    @MutationMapping
    public boolean revokeStationCredential(@Argument String stationId) {
        var station = stationQueryService.findById(stationId)
                .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));

        tenantAuthorizationService.assertAuthorized(station.organizationId(), Permission.CREDENTIAL_REVOKE);

        var user = SecurityContext.get();
        return credentialService.revokeCredential(
                station.id(),
                user != null ? user.userId() : "SYSTEM",
                station.organizationId()
        );
    }

    // --- Administrative Audit Query ---

    @QueryMapping
    public AuditEventPageView administrativeAuditEvents(
            @Argument String organizationId,
            @Argument Integer page,
            @Argument Integer size
    ) {
        String org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
        tenantAuthorizationService.assertAuthorized(org, Permission.AUDIT_READ);

        int p = page != null ? page : 0;
        int s = size != null ? size : 20;
        var paged = auditService.findEvents(org, p, s);

        return new AuditEventPageView(
                paged.getContent(),
                paged.getTotalElements(),
                paged.getTotalPages(),
                paged.getNumber(),
                paged.getSize()
        );
    }
}
