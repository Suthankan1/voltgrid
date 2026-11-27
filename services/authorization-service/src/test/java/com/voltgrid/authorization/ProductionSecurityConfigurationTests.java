package com.voltgrid.authorization;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityConfigurationTests {

    private static final String VALID_BUNDLE = "authorization-server-bundle";
    private static final String VALID_DB_URL = "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_authorization?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rds.pem";

    @Test
    void allowsValidProductionConfiguration() {
        assertThatCode(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                VALID_BUNDLE,
                VALID_DB_URL
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsPlaintextDatabaseUrl() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                VALID_BUNDLE,
                "jdbc:postgresql://db.voltgrid.internal:5432/voltgrid_authorization"
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production security requires authenticated endpoints, explicit credentials and TLS");
    }

    @Test
    void rejectsDisabledGrpcTls() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                false,
                VALID_BUNDLE,
                VALID_DB_URL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsBlankSslBundle() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                true,
                true,
                "",
                VALID_DB_URL
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsDisabledServiceAuthOrInsecureKeys() {
        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                false,
                true,
                true,
                VALID_BUNDLE,
                VALID_DB_URL
        )).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> new ProductionSecurityConfiguration(
                true,
                false,
                true,
                VALID_BUNDLE,
                VALID_DB_URL
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
}
