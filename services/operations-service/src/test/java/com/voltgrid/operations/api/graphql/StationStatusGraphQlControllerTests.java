package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.application.StationStatusQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.graphql.test.autoconfigure.GraphQlTest;
import org.springframework.graphql.test.tester.GraphQlTester;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.mockito.Mockito.when;

@GraphQlTest(
        StationStatusGraphQlController.class
)
class StationStatusGraphQlControllerTests {

    @Autowired
    private GraphQlTester graphQlTester;

    @MockitoBean
    private StationStatusQueryService queryService;

    @Test
    void shouldReturnStationStatus() {
        when(
                queryService.findByStationId(
                        "STATION-001"
                )
        ).thenReturn(
                new StationStatusView(
                        "STATION-001",
                        "ONLINE",
                        "8f40a61d-c718-4e66-a88f-8ed989730001",
                        "2026-09-17T06:00:00Z",
                        "2026-09-17T06:00:01Z"
                )
        );

        graphQlTester
                .document(
                        """
                        query StationStatus($stationId: ID!) {
                          stationStatus(stationId: $stationId) {
                            stationId
                            currentStatus
                            lastEventId
                            statusChangedAt
                            updatedAt
                          }
                        }
                        """
                )
                .variable(
                        "stationId",
                        "STATION-001"
                )
                .execute()
                .path(
                        "stationStatus.stationId"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "STATION-001"
                )
                .path(
                        "stationStatus.currentStatus"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "ONLINE"
                )
                .path(
                        "stationStatus.lastEventId"
                )
                .entity(
                        String.class
                )
                .isEqualTo(
                        "8f40a61d-c718-4e66-a88f-8ed989730001"
                );
    }
}