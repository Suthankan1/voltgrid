package com.voltgrid.authorization;

import io.netty.handler.ssl.util.SelfSignedCertificate;
import org.junit.jupiter.api.Test;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PostgresTlsIntegrationTests {

    @Test
    void verifiesPostgresCertificateAndHostnameOnTheWire() throws Exception {
        var certificate = new SelfSignedCertificate("localhost");
        var untrustedCertificate = new SelfSignedCertificate("localhost");
        try (var postgres = new PostgreSQLContainer("postgres:18.6")) {
            postgres.withCopyToContainer(Transferable.of(Files.readAllBytes(certificate.certificate().toPath())),
                            "/tmp/fixture.crt")
                    .withCopyToContainer(Transferable.of(Files.readAllBytes(certificate.privateKey().toPath()), 0600),
                            "/tmp/fixture.key")
                    .withCopyToContainer(Transferable.of("""
                            local all all trust
                            hostssl all all all scram-sha-256
                            hostnossl all all all reject
                            """), "/tmp/fixture-hba.conf")
                    .withCommand("bash", "-ec", """
                            install -o postgres -g postgres -m 0600 /tmp/fixture.key /tmp/server.key
                            exec docker-entrypoint.sh postgres -c ssl=on                               -c ssl_cert_file=/tmp/fixture.crt -c ssl_key_file=/tmp/server.key                               -c hba_file=/tmp/fixture-hba.conf
                            """);
            postgres.start();

            String url = "jdbc:postgresql://localhost:" + postgres.getMappedPort(5432)
                    + "/" + postgres.getDatabaseName();
            Properties credentials = new Properties();
            credentials.setProperty("user", postgres.getUsername());
            credentials.setProperty("password", postgres.getPassword());
            credentials.setProperty("sslrootcert", certificate.certificate().getAbsolutePath());

            String secureUrl = url + "?sslmode=verify-full";
            assertThat(ProductionSecurityConfiguration.isSecureDatabaseUrl(secureUrl)).isTrue();
            try (var connection = DriverManager.getConnection(secureUrl, credentials);
                 var statement = connection.createStatement();
                 var result = statement.executeQuery("select ssl from pg_stat_ssl where pid = pg_backend_pid()")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBoolean("ssl")).isTrue();
            }

            assertThatThrownBy(() -> connect(secureUrl.replace("://localhost:", "://127.0.0.1:"), credentials))
                    .isInstanceOf(SQLException.class).hasMessageContaining("hostname");
            assertThatThrownBy(() -> connect(url + "?sslmode=disable", credentials))
                    .isInstanceOf(SQLException.class).hasMessageContaining("no encryption");

            var invalidCredentials = new Properties(credentials);
            invalidCredentials.setProperty("password", postgres.getPassword() + "-invalid");
            assertThatThrownBy(() -> connect(secureUrl, invalidCredentials))
                    .isInstanceOfSatisfying(SQLException.class,
                            error -> assertThat(error.getSQLState()).isEqualTo("28P01"));

            credentials.setProperty("sslrootcert", untrustedCertificate.certificate().getAbsolutePath());
            assertThatThrownBy(() -> connect(secureUrl, credentials))
                    .isInstanceOf(SQLException.class).hasMessageContaining("SSL");
        } finally {
            certificate.delete();
            untrustedCertificate.delete();
        }
    }

    private static void connect(String url, Properties credentials) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, credentials)) {
            assertThat(connection.isValid(1)).isTrue();
        }
    }
}
