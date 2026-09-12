package com.voltgrid.integration;

import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class AuthorizationServiceProcessTests {

    private static final Duration STARTUP_TIMEOUT =
            Duration.ofSeconds(30);

    @Test
    void shouldStartAuthorizationServiceAgainstPostgres()
            throws Exception {

        try (
                var postgres =
                        new PostgreSQLContainer(
                                "postgres:18.6"
                        )
                                .withDatabaseName(
                                        "voltgrid_authorization"
                                )
                                .withUsername(
                                        "voltgrid"
                                )
                                .withPassword(
                                        "voltgrid_dev"
                                )
        ) {
            postgres.start();

            var grpcPort =
                    findAvailablePort();

            var repoRoot =
                    Path.of(
                                    "..",
                                    ".."
                            )
                            .toAbsolutePath()
                            .normalize();

            var authorizationServiceDirectory =
                    repoRoot.resolve(
                            "services/authorization-service"
                    );

            assertTrue(
                    Files.isDirectory(
                            authorizationServiceDirectory
                    ),
                    "Authorization Service directory does not exist: "
                            + authorizationServiceDirectory
            );

            var logFile =
                    Files.createTempFile(
                            "voltgrid-authorization-service-",
                            ".log"
                    );

            var process =
                    startAuthorizationService(
                            authorizationServiceDirectory,
                            logFile,
                            postgres,
                            grpcPort
                    );

            try {
                waitUntilPortOpen(
                        process,
                        logFile,
                        grpcPort,
                        STARTUP_TIMEOUT
                );

                assertTrue(
                        process.isAlive(),
                        "Authorization Service should still be running"
                );

            } finally {
                stopProcessTree(process);
                Files.deleteIfExists(logFile);
            }
        }
    }

    private Process startAuthorizationService(
            Path serviceDirectory,
            Path logFile,
            PostgreSQLContainer postgres,
            int grpcPort
    ) throws IOException {

        var processBuilder =
                new ProcessBuilder(
                        "./mvnw",
                        "--batch-mode",
                        "--no-transfer-progress",
                        "-DskipTests",
                        "-Dspring-boot.run.arguments="
                                + "--spring.grpc.server.port="
                                + grpcPort,
                        "spring-boot:run"
                );

        processBuilder.directory(
                serviceDirectory.toFile()
        );

        processBuilder.redirectErrorStream(true);

        processBuilder.redirectOutput(
                logFile.toFile()
        );

        var environment =
                processBuilder.environment();

        environment.put(
                "AUTHORIZATION_DB_URL",
                postgres.getJdbcUrl()
        );

        environment.put(
                "AUTHORIZATION_DB_USER",
                postgres.getUsername()
        );

        environment.put(
                "AUTHORIZATION_DB_PASSWORD",
                postgres.getPassword()
        );

        environment.put(
                "AUTHORIZATION_TOKEN_HMAC_KEY",
                "0123456789abcdef0123456789abcdef"
        );

        return processBuilder.start();
    }

    private void waitUntilPortOpen(
            Process process,
            Path logFile,
            int port,
            Duration timeout
    ) throws Exception {

        var deadline =
                System.nanoTime()
                        + timeout.toNanos();

        while (System.nanoTime() < deadline) {

            if (!process.isAlive()) {
                fail(
                        """
                        Authorization Service exited before becoming ready.

                        Process output:
                        %s
                        """
                                .formatted(
                                        Files.readString(
                                                logFile
                                        )
                                )
                );
            }

            try (
                    var socket =
                            new Socket()
            ) {
                socket.connect(
                        new InetSocketAddress(
                                "localhost",
                                port
                        ),
                        250
                );

                return;

            } catch (IOException ignored) {
                Thread.sleep(200);
            }
        }

        fail(
                """
                Authorization Service did not become reachable within %s.

                Process output:
                %s
                """
                        .formatted(
                                timeout,
                                Files.readString(
                                        logFile
                                )
                        )
        );
    }

    private int findAvailablePort()
            throws IOException {

        try (
                var socket =
                        new ServerSocket(0)
        ) {
            return socket.getLocalPort();
        }
    }

    private void stopProcessTree(
            Process process
    ) throws InterruptedException {

        List<ProcessHandle> descendants =
                process.toHandle()
                        .descendants()
                        .toList();

        descendants.forEach(
                ProcessHandle::destroy
        );

        process.destroy();

        if (!process.waitFor(
                5,
                TimeUnit.SECONDS
        )) {
            descendants.forEach(
                    ProcessHandle::destroyForcibly
            );

            process.destroyForcibly();

            process.waitFor(
                    5,
                    TimeUnit.SECONDS
            );
        }
    }
}