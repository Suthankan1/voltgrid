package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationAlreadyExistsException;
import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.GraphQlTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.test.tester.GraphQlTester;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;

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

    @Test
    void shouldListStations() {
        when(stationQueryService.findAll()).thenReturn(List.of(
                new ChargingStation(
                        "STATION-001",
                        "Colombo Central",
                        StationStatus.ONLINE
                )
        ));

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

        response.path("stations[0].id")
                .entity(String.class)
                .isEqualTo("STATION-001");

        response.path("stations[0].name")
                .entity(String.class)
                .isEqualTo("Colombo Central");

        response.path("stations[0].status")
                .entity(String.class)
                .isEqualTo("ONLINE");
    }

    @Test
    void shouldFindStationById() {
        when(stationQueryService.findById("STATION-001"))
                .thenReturn(Optional.of(
                        new ChargingStation(
                                "STATION-001",
                                "Colombo Central",
                                StationStatus.ONLINE
                        )
                ));

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

        response.path("station.id")
                .entity(String.class)
                .isEqualTo("STATION-001");
    }

    @Test
    void shouldRegisterStation() {
        when(stationRegistrationService.register(
                "STATION-003",
                "Galle Central"
        )).thenReturn(
                new ChargingStation(
                        "STATION-003",
                        "Galle Central",
                        StationStatus.OFFLINE
                )
        );

        var response = graphQlTester.document("""
                mutation {
                    registerStation(
                        input: {
                            id: "STATION-003"
                            name: "Galle Central"
                        }
                    ) {
                        id
                        name
                        status
                    }
                }
                """)
                .execute();

        response.path("registerStation.id")
                .entity(String.class)
                .isEqualTo("STATION-003");

        response.path("registerStation.status")
                .entity(String.class)
                .isEqualTo("OFFLINE");
    }

    @Test
    void shouldReturnBadRequestWhenStationAlreadyExists() {
        when(stationRegistrationService.register(
                "STATION-001",
                "Colombo Central"
        )).thenThrow(
                new StationAlreadyExistsException("STATION-001")
        );

        graphQlTester.document("""
            mutation {
                registerStation(
                    input: {
                        id: "STATION-001"
                        name: "Colombo Central"
                    }
                ) {
                    id
                }
            }
            """)
                .execute()
                .errors()
                .expect(error ->
                        error.getMessage()
                                .equals("Station already exists: STATION-001")
                )
                .verify();
    }

    @Test
    void shouldRejectBlankStationName() {
        graphQlTester.document("""
            mutation {
                registerStation(
                    input: {
                        id: "STATION-004"
                        name: ""
                    }
                ) {
                    id
                }
            }
            """)
                .execute()
                .errors()
                .expect(error ->
                        error.getMessage()
                                .contains("station name must not be blank")
                )
                .verify();
    }
}