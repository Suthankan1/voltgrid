package com.voltgrid.integration;

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

import static org.junit.jupiter.api.Assertions.fail;

final class AuthorizationFlowTestEnvironment
        implements AutoCloseable {

    static final String TEST_HMAC_KEY =
            "0123456789abcdef0123456789abcdef";

    private static final Duration STARTUP_TIMEOUT =
            Duration.ofSeconds(45);

    private final PostgreSQLContainer authorizationPostgres;
    private final PostgreSQLContainer stationPostgres;

    private final int authorizationGrpcPort;
    private final int stationHttpPort;

    private final Path authorizationLog;
    private final Path stationLog;

    private Process authorizationProcess;
    private Process stationProcess;

    private AuthorizationFlowTestEnvironment()
            throws Exception {

        authorizationPostgres =
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

        stationPostgres =
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
                        );

        authorizationGrpcPort =
                findAvailablePort();

        stationHttpPort =
                findAvailablePort();

        authorizationLog =
                Files.createTempFile(
                        "voltgrid-authorization-service-",
                        ".log"
                );

        stationLog =
                Files.createTempFile(
                        "voltgrid-station-service-",
                        ".log"
                );
    }

    static AuthorizationFlowTestEnvironment start()
            throws Exception {

        var environment =
                new AuthorizationFlowTestEnvironment();

        try {
            environment.startInternal();
            return environment;

        } catch (Exception exception) {
            environment.close();
            throw exception;
        }
    }

    private void startInternal()
            throws Exception {

        authorizationPostgres.start();
        stationPostgres.start();

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

        authorizationProcess =
                startAuthorizationService(
                        authorizationServiceDirectory
                );

        waitUntilPortOpen(
                "Authorization Service",
                authorizationProcess,
                authorizationLog,
                authorizationGrpcPort
        );

        stationProcess =
                startStationService(
                        stationServiceDirectory
                );

        waitUntilPortOpen(
                "Station Service",
                stationProcess,
                stationLog,
                stationHttpPort
        );
    }

    int stationHttpPort() {
        return stationHttpPort;
    }

    PostgreSQLContainer authorizationPostgres() {
        return authorizationPostgres;
    }

    PostgreSQLContainer stationPostgres() {
        return stationPostgres;
    }

    boolean authorizationServiceIsAlive() {
        return authorizationProcess != null
                && authorizationProcess.isAlive();
    }

    boolean stationServiceIsAlive() {
        return stationProcess != null
                && stationProcess.isAlive();
    }

    private Process startAuthorizationService(
            Path serviceDirectory
    ) throws IOException {

        var arguments =
                String.join(
                        " ",
                        "--spring.datasource.url="
                                + authorizationPostgres.getJdbcUrl(),

                        "--spring.datasource.username="
                                + authorizationPostgres.getUsername(),

                        "--spring.datasource.password="
                                + authorizationPostgres.getPassword(),

                        "--spring.grpc.server.port="
                                + authorizationGrpcPort,

                        "--voltgrid.authorization.token-hmac-key="
                                + TEST_HMAC_KEY
                );

        return startSpringBootProcess(
                serviceDirectory,
                authorizationLog,
                arguments
        );
    }

    private Process startStationService(
            Path serviceDirectory
    ) throws IOException {

        var arguments =
                String.join(
                        " ",
                        "--spring.datasource.url="
                                + stationPostgres.getJdbcUrl(),

                        "--spring.datasource.username="
                                + stationPostgres.getUsername(),

                        "--spring.datasource.password="
                                + stationPostgres.getPassword(),

                        "--server.port="
                                + stationHttpPort,

                        "--spring.grpc.client.channel.authorization.target="
                                + "static://localhost:"
                                + authorizationGrpcPort,

                        "--spring.grpc.client.channel.authorization.ssl.enabled=false"
                );

        return startSpringBootProcess(
                serviceDirectory,
                stationLog,
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
            int port
    ) throws Exception {

        var deadline =
                System.nanoTime()
                        + STARTUP_TIMEOUT.toNanos();

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
                                STARTUP_TIMEOUT,
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

    @Override
    public void close()
            throws Exception {

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

        if (stationPostgres != null
                && stationPostgres.isRunning()) {

            stationPostgres.stop();
        }

        if (authorizationPostgres != null
                && authorizationPostgres.isRunning()) {

            authorizationPostgres.stop();
        }

        Files.deleteIfExists(
                stationLog
        );

        Files.deleteIfExists(
                authorizationLog
        );
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