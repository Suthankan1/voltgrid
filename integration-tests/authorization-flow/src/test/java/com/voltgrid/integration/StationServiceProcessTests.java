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

class StationServiceProcessTests {

    private static final Duration STARTUP_TIMEOUT =
            Duration.ofSeconds(45);

    private static final String TEST_HMAC_KEY =
            "0123456789abcdef0123456789abcdef";

    @Test
    void shouldStartStationServiceWithAuthorizationService()
            throws Exception {

        try (
                var authorizationPostgres =
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
                                );

                var stationPostgres =
                        new PostgreSQLContainer(
                                "postgres:18.6"
                        )
                                .withDatabaseName(
                                        "voltgrid_station"
                                )
                                .withUsername(
                                        "voltgrid"
                                )
                                .withPassword(
                                        "voltgrid_dev"
                                )
        ) {
            authorizationPostgres.start();
            stationPostgres.start();

            var authorizationGrpcPort =
                    findAvailablePort();

            var stationHttpPort =
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

            var stationServiceDirectory =
                    repoRoot.resolve(
                            "services/station-service"
                    );

            assertTrue(
                    Files.isDirectory(
                            authorizationServiceDirectory
                    )
            );

            assertTrue(
                    Files.isDirectory(
                            stationServiceDirectory
                    )
            );

            var authorizationLog =
                    Files.createTempFile(
                            "voltgrid-authorization-service-",
                            ".log"
                    );

            var stationLog =
                    Files.createTempFile(
                            "voltgrid-station-service-",
                            ".log"
                    );

            Process authorizationProcess = null;
            Process stationProcess = null;

            try {
                authorizationProcess =
                        startAuthorizationService(
                                authorizationServiceDirectory,
                                authorizationLog,
                                authorizationPostgres,
                                authorizationGrpcPort
                        );

                waitUntilPortOpen(
                        "Authorization Service",
                        authorizationProcess,
                        authorizationLog,
                        authorizationGrpcPort,
                        STARTUP_TIMEOUT
                );

                stationProcess =
                        startStationService(
                                stationServiceDirectory,
                                stationLog,
                                stationPostgres,
                                stationHttpPort,
                                authorizationGrpcPort
                        );

                waitUntilPortOpen(
                        "Station Service",
                        stationProcess,
                        stationLog,
                        stationHttpPort,
                        STARTUP_TIMEOUT
                );

                assertTrue(
                        authorizationProcess.isAlive()
                );

                assertTrue(
                        stationProcess.isAlive()
                );

            } finally {
                if (stationProcess != null) {
                    stopProcessTree(
                            stationProcess
                    );
                }

                if (authorizationProcess != null) {
                    stopProcessTree(
                            authorizationProcess
                    );
                }

                Files.deleteIfExists(
                        stationLog
                );

                Files.deleteIfExists(
                        authorizationLog
                );
            }
        }
    }

    private Process startAuthorizationService(
            Path serviceDirectory,
            Path logFile,
            PostgreSQLContainer postgres,
            int grpcPort
    ) throws IOException {

        var arguments =
                String.join(
                        " ",
                        "--spring.datasource.url="
                                + postgres.getJdbcUrl(),

                        "--spring.datasource.username="
                                + postgres.getUsername(),

                        "--spring.datasource.password="
                                + postgres.getPassword(),

                        "--spring.grpc.server.port="
                                + grpcPort,

                        "--voltgrid.authorization.token-hmac-key="
                                + TEST_HMAC_KEY
                );

        return startSpringBootProcess(
                serviceDirectory,
                logFile,
                arguments
        );
    }

    private Process startStationService(
            Path serviceDirectory,
            Path logFile,
            PostgreSQLContainer postgres,
            int httpPort,
            int authorizationGrpcPort
    ) throws IOException {

        var arguments =
                String.join(
                        " ",
                        "--spring.datasource.url="
                                + postgres.getJdbcUrl(),

                        "--spring.datasource.username="
                                + postgres.getUsername(),

                        "--spring.datasource.password="
                                + postgres.getPassword(),

                        "--server.port="
                                + httpPort,

                        "--spring.grpc.client.channel.authorization.target="
                                + "static://localhost:"
                                + authorizationGrpcPort,

                        "--spring.grpc.client.channel.authorization.ssl.enabled=false"
                );

        return startSpringBootProcess(
                serviceDirectory,
                logFile,
                arguments
        );
    }

    private Process startSpringBootProcess(
            Path serviceDirectory,
            Path logFile,
            String springArguments
    ) throws IOException {

        var processBuilder =
                new ProcessBuilder(
                        "./mvnw",
                        "--batch-mode",
                        "--no-transfer-progress",
                        "-DskipTests",
                        "-Dspring-boot.run.arguments="
                                + springArguments,
                        "spring-boot:run"
                );

        processBuilder.directory(
                serviceDirectory.toFile()
        );

        processBuilder.redirectErrorStream(
                true
        );

        processBuilder.redirectOutput(
                logFile.toFile()
        );

        return processBuilder.start();
    }

    private void waitUntilPortOpen(
            String serviceName,
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
                        %s exited before becoming ready.

                        Process output:
                        %s
                        """
                                .formatted(
                                        serviceName,
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
                %s did not become reachable within %s.

                Process output:
                %s
                """
                        .formatted(
                                serviceName,
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