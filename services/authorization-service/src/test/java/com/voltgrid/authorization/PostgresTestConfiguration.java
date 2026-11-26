package com.voltgrid.authorization;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.test.context.DynamicPropertyRegistrar;

import java.security.SecureRandom;
import java.util.HexFormat;

@TestConfiguration(proxyBeanMethods = false)
public class PostgresTestConfiguration {

    @Bean
    DynamicPropertyRegistrar testKeys() {
        var random = new SecureRandom();
        var fingerprintKey = HexFormat.of().formatHex(random.generateSeed(32));
        var stationServiceKey = HexFormat.of().formatHex(random.generateSeed(32));
        return registry -> {
            registry.add("voltgrid.authorization.token-hmac-key", () -> fingerprintKey);
            registry.add("voltgrid.service-auth.service-keys.station-service", () -> stationServiceKey);
        };
    }

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(
                "postgres:18.6"
        );
    }
}