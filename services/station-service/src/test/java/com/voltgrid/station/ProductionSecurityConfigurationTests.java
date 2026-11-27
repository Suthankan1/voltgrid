package com.voltgrid.station;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityConfigurationTests {

    private static final String VALID_ISSUER = "https://idp.voltgrid.internal/realms/voltgrid";
    private static final String VALID_JWKS = "https://idp.voltgrid.internal/realms/voltgrid/protocol/openid-connect/certs";
    private static final String VALID_STATION_KEY = "station-service-production-secret-key-at-least-32-chars";
    private static final String VALID_DB_URL = "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_station?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rds.pem";
    private static final String VALID_KAFKA_PROTOCOL = "SSL";

    @Test
    void allowsValidProductionConfiguration() {
        assertThatCode(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_KEY,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsPlaintextDatabaseUrl() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_KEY,
                "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_station",
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production security requires authenticated endpoints, explicit credentials and TLS");
    }

    @Test
    void rejectsPlaintextKafkaProtocol() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_KEY,
                VALID_DB_URL,
                "PLAINTEXT"
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsDisabledSecureTransport() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                false,
                true,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_KEY,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsDisabledGrpcTls() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                false,
                VALID_ISSUER,
                VALID_JWKS,
                VALID_STATION_KEY,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsShortStationKey() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                VALID_ISSUER,
                VALID_JWKS,
                "short-key",
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsInsecureHttpIssuerOrJwks() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                "http://idp.voltgrid.internal",
                VALID_JWKS,
                VALID_STATION_KEY,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                true,
                VALID_ISSUER,
                "http://idp.voltgrid.internal/jwks",
                VALID_STATION_KEY,
                VALID_DB_URL,
                VALID_KAFKA_PROTOCOL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void validatesDatabaseSslModes() {
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=verify-full")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=verify-ca")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?ssl=true")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=require")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(null)).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(
                "jdbc:postgresql://host/db?sslmode=verify%2Dfull")).isTrue();

        for (String properties : new String[] {
                "applicationName=sslmode%3Dverify-full",
                "sslmode=verify-full-extra",
                "sslmode=verify-full&sslmode=disable",
                "ssl=true&sslmode=disable",
                "sslmode=verify-full&sslfactory=org.postgresql.ssl.NonValidatingFactory",
                "sslmode=verify-full&sslhostnameverifier=com.example.CustomVerifier",
                "sslmode=verify-full&gssEncMode=require",
                "sslmode=verify%ZZ"
        }) {
            assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(
                    "jdbc:postgresql://host/db?" + properties)).as(properties).isFalse();
        }
    }

    @Test
    void validatesKafkaProtocols() {
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("SSL")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("SASL_SSL")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("PLAINTEXT")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol("SASL_PLAINTEXT")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureKafkaProtocol(null)).isFalse();
    }
}
