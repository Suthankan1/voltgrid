package com.voltgrid.operations;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityConfigurationTests {

    private static final String VALID_ISSUER = "https://idp.voltgrid.internal/realms/voltgrid";
    private static final String VALID_JWKS = "https://idp.voltgrid.internal/realms/voltgrid/protocol/openid-connect/certs";
    private static final String VALID_STATION_ACCESS = "https://station.voltgrid.internal:8080";
    private static final String VALID_DB_URL = "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_operations?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rds.pem";
    private static final String VALID_KAFKA_PROTOCOL = "SSL";

    @Test
    void allowsValidProductionConfiguration() {
        assertThatCode(() -> new ProductionSecurityConfiguration(
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_ACCESS,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsPlaintextDatabaseUrl() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_ACCESS,
                "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_operations",
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production security requires authenticated endpoints, explicit credentials and TLS");
    }

    @Test
    void rejectsPlaintextKafkaProtocol() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_ACCESS,
                VALID_DB_URL,
                "PLAINTEXT"
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsInsecureStationAccessUrl() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                VALID_ISSUER,
                VALID_JWKS,
                "http://station.voltgrid.internal:8080",
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsInsecureIssuerOrJwks() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                "http://idp.voltgrid.internal",
                VALID_JWKS,
                VALID_STATION_ACCESS,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                VALID_ISSUER,
                "http://idp.voltgrid.internal/jwks",
                VALID_STATION_ACCESS,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void validatesDatabaseSslModes() {
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=verify-full")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=verify-ca")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?ssl=true")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=require")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(null)).isFalse();
    }

    @Test
    void validatesKafkaProtocols() {
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("SSL")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("SASL_SSL")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("PLAINTEXT")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol(null)).isFalse();
    }
}
