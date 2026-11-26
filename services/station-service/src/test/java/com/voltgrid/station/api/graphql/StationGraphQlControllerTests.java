package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationAlreadyExistsException;
import com.voltgrid.station.application.StationConnectorQueryService;
import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.application.security.AdministrativeAuditService;
import com.voltgrid.station.application.security.StationCredentialService;
import com.voltgrid.station.application.security.TenantAuthorizationService;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.SiteJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.GraphQlTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.test.tester.GraphQlTester;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@GraphQlTest(StationGraphQlController.class)
@Import(StationGraphQlExceptionHandler.class)
class StationGraphQlControllerTests {

    @Autowired
    private GraphQlTester graphQlTester;

    @MockitoBean
    private StationQueryService stationQueryService;

    @MockitoBean
    private StationRegistrationService stationRegistrationService;

    @MockitoBean
    private StationConnectorQueryService connectorQueryService;

    @MockitoBean
    private TenantAuthorizationService tenantAuthorizationService;

    @MockitoBean
    private OrganizationJpaRepository organizationRepository;

    @MockitoBean
    private SiteJpaRepository siteRepository;

    @MockitoBean
    private OrganizationMembershipJpaRepository membershipRepository;

    @MockitoBean
    private StationCredentialService credentialService;

    @MockitoBean
    private AdministrativeAuditService auditService;

    @BeforeEach
    void setUp() {
        when(tenantAuthorizationService.resolveAuthorizedOrganizationId(any()))
                .thenReturn("org_voltgrid_default");
    }

    @Test
    void shouldListStations() {
        when(stationQueryService.findByOrganizationId("org_voltgrid_default"))
                .thenReturn(
                        List.of(
                                new ChargingStation(
                                        "STATION-001",
                                        "Colombo Central",
                                        StationStatus.ONLINE
                                )
                        )
                );

        var response = graphQlTester.document("""
                query {
                    stations {
                        id
                        name
                        status
                    }
                }
                """)
                .execute();

        response.path("stations[0].id").entity(String.class).isEqualTo("STATION-001");
        response.path("stations[0].name").entity(String.class).isEqualTo("Colombo Central");
        response.path("stations[0].status").entity(String.class).isEqualTo("ONLINE");
    }

    @Test
    void shouldGetStationById() {
        when(stationQueryService.findByIdAndOrganizationId("STATION-001", "org_voltgrid_default"))
                .thenReturn(
                        Optional.of(
                                new ChargingStation(
                                        "STATION-001",
                                        "Colombo Central",
                                        StationStatus.ONLINE
                                )
                        )
                );

        var response = graphQlTester.document("""
                query {
                    station(id: "STATION-001") {
                        id
                        name
                        status
                    }
                }
                """)
                .execute();

        response.path("station.id").entity(String.class).isEqualTo("STATION-001");
        response.path("station.name").entity(String.class).isEqualTo("Colombo Central");
        response.path("station.status").entity(String.class).isEqualTo("ONLINE");
    }

    @Test
    void shouldRegisterStation() {
        when(stationRegistrationService.register("STATION-002", "Kandy Express", "org_voltgrid_default", null))
                .thenReturn(
                        new ChargingStation(
                                "STATION-002",
                                "Kandy Express",
                                StationStatus.OFFLINE
                        )
                );

        var response = graphQlTester.document("""
                mutation {
                    registerStation(input: {
                        id: "STATION-002"
                        name: "Kandy Express"
                    }) {
                        id
                        name
                        status
                    }
                }
                """)
                .execute();

        response.path("registerStation.id").entity(String.class).isEqualTo("STATION-002");
        response.path("registerStation.name").entity(String.class).isEqualTo("Kandy Express");
        response.path("registerStation.status").entity(String.class).isEqualTo("OFFLINE");
    }

    @Test
    void shouldFailWhenStationAlreadyExists() {
        when(stationRegistrationService.register("STATION-001", "Colombo Central", "org_voltgrid_default", null))
                .thenThrow(
                        new StationAlreadyExistsException("STATION-001")
                );

        graphQlTester.document("""
                mutation {
                    registerStation(input: {
                        id: "STATION-001"
                        name: "Colombo Central"
                    }) {
                        id
                    }
                }
                """)
                .execute()
                .errors()
                .satisfy(errors -> {
                    org.assertj.core.api.Assertions.assertThat(errors).hasSize(1);
                    org.assertj.core.api.Assertions.assertThat(errors.get(0).getMessage())
                            .isEqualTo("Station already exists: STATION-001");
                });
    }

    @Test
    void shouldListStationConnectors() {
        var timestamp = Instant.parse("2026-09-08T15:00:00Z");

        when(stationQueryService.findByIdAndOrganizationId("STATION-001", "org_voltgrid_default"))
                .thenReturn(Optional.of(new ChargingStation("STATION-001", "Colombo Central", StationStatus.ONLINE)));
        when(connectorQueryService.findByStationId("STATION-001"))
                .thenReturn(
                        List.of(
                                new StationConnector(
                                        "STATION-001",
                                        1,
                                        1,
                                        ConnectorStatus.AVAILABLE,
                                        timestamp
                                ),
                                new StationConnector(
                                        "STATION-001",
                                        1,
                                        2,
                                        ConnectorStatus.OCCUPIED,
                                        timestamp
                                )
                        )
                );

        var response = graphQlTester.document("""
                query {
                    stationConnectors(stationId: "STATION-001") {
                        evseId
                        connectorId
                        status
                        statusUpdatedAt
                    }
                }
                """)
                .execute();

        response.path("stationConnectors[0].evseId").entity(Integer.class).isEqualTo(1);
        response.path("stationConnectors[0].connectorId").entity(Integer.class).isEqualTo(1);
        response.path("stationConnectors[0].status").entity(String.class).isEqualTo("AVAILABLE");
        response.path("stationConnectors[0].statusUpdatedAt").entity(String.class).isEqualTo("2026-09-08T15:00:00Z");

        response.path("stationConnectors[1].evseId").entity(Integer.class).isEqualTo(1);
        response.path("stationConnectors[1].connectorId").entity(Integer.class).isEqualTo(2);
        response.path("stationConnectors[1].status").entity(String.class).isEqualTo("OCCUPIED");
        response.path("stationConnectors[1].statusUpdatedAt").entity(String.class).isEqualTo("2026-09-08T15:00:00Z");
    }
}
