package com.voltgrid.integration;

import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthorizationFlowHarnessTests {

    @Test
    void shouldStartPostgresForAuthorizationFlow() {
        try (
                var postgres =
                        new PostgreSQLContainer(
                                "postgres:18.6"
                        )
        ) {
            postgres.start();

            assertTrue(
                    postgres.isRunning()
            );
        }
    }
}