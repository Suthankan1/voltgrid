package com.voltgrid.integration;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class StationServiceProcessTests {

    @Test
    void shouldStartStationServiceWithAuthorizationService()
            throws Exception {

        try (
                var environment =
                        AuthorizationFlowTestEnvironment.start()
        ) {
            assertTrue(
                    environment.authorizationServiceIsAlive()
            );

            assertTrue(
                    environment.stationServiceIsAlive()
            );
        }
    }
}