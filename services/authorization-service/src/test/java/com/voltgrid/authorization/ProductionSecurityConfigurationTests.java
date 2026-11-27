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
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=verify-ca")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?ssl=true")).isTrue();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db?sslmode=require")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("jdbc:postgresql://host:5432/db")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl("")).isFalse();
        assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(null)).isFalse();
    }
}
