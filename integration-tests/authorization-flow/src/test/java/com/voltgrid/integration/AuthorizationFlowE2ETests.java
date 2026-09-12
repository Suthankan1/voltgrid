package com.voltgrid.integration;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class AuthorizationFlowE2ETests {

    private static final Duration RESPONSE_TIMEOUT =
            Duration.ofSeconds(5);

    @Test
    void shouldAuthorizeTokenStatesThroughFullOcppFlow()
            throws Exception {

        try (
                var environment =
                        AuthorizationFlowTestEnvironment.start();

                var httpClient =
                        HttpClient.newHttpClient()
        ) {
            seedStation(
                    environment,
                    "STATION-E2E"
            );

            seedToken(
                    environment,
                    "ACTIVE-RFID",
                    "ACTIVE",
                    null
            );

            seedToken(
                    environment,
                    "BLOCKED-RFID",
                    "BLOCKED",
                    null
            );

            seedToken(
                    environment,
                    "EXPIRED-RFID",
                    "ACTIVE",
                    Instant.now()
                            .minusSeconds(60)
            );

            var listener =
                    new QueueingWebSocketListener();

            var webSocket =
                    httpClient
                            .newWebSocketBuilder()
                            .subprotocols(
                                    "ocpp2.0.1"
                            )
                            .buildAsync(
                                    URI.create(
                                            "ws://localhost:"
                                                    + environment.stationHttpPort()
                                                    + "/ocpp/STATION-E2E"
                                    ),
                                    listener
                            )
                            .join();

            try {
                assertEquals(
                        "ocpp2.0.1",
                        webSocket.getSubprotocol()
                );

                send(
                        webSocket,
                        """
                        [
                          2,
                          "boot-e2e-001",
                          "BootNotification",
                          {
                            "reason": "PowerUp",
                            "chargingStation": {
                              "model": "VoltGrid-E2E",
                              "vendorName": "VoltGrid"
                            }
                          }
                        ]
                        """
                );

                var bootResponse =
                        listener.awaitMessage(
                                RESPONSE_TIMEOUT
                        );

                assertCallResultStatus(
                        bootResponse,
                        "boot-e2e-001",
                        "Accepted"
                );

                assertAuthorizationStatus(
                        webSocket,
                        listener,
                        "auth-e2e-active-001",
                        "ACTIVE-RFID",
                        "Accepted"
                );

                assertAuthorizationStatus(
                        webSocket,
                        listener,
                        "auth-e2e-blocked-001",
                        "BLOCKED-RFID",
                        "Blocked"
                );

                assertAuthorizationStatus(
                        webSocket,
                        listener,
                        "auth-e2e-expired-001",
                        "EXPIRED-RFID",
                        "Expired"
                );

                assertAuthorizationStatus(
                        webSocket,
                        listener,
                        "auth-e2e-unknown-001",
                        "UNKNOWN-RFID",
                        "Invalid"
                );

            } finally {
                webSocket.sendClose(
                        WebSocket.NORMAL_CLOSURE,
                        "test complete"
                ).join();
            }
        }
    }

    private void assertAuthorizationStatus(
            WebSocket webSocket,
            QueueingWebSocketListener listener,
            String messageId,
            String rawToken,
            String expectedStatus
    ) throws InterruptedException {

        send(
                webSocket,
                """
                [
                  2,
                  "%s",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "%s",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
                        .formatted(
                                messageId,
                                rawToken
                        )
        );

        var response =
                listener.awaitMessage(
                        RESPONSE_TIMEOUT
                );

        assertCallResultStatus(
                response,
                messageId,
                expectedStatus
        );
    }

    private void seedStation(
            AuthorizationFlowTestEnvironment environment,
            String stationId
    ) throws Exception {

        var postgres =
                environment.stationPostgres();

        var sql =
                """
                INSERT INTO charging_stations (
                    id,
                    name,
                    status,
                    last_seen_at
                )
                VALUES (
                    ?,
                    ?,
                    'OFFLINE',
                    NULL
                )
                """;

        try (
                var connection =
                        DriverManager.getConnection(
                                postgres.getJdbcUrl(),
                                postgres.getUsername(),
                                postgres.getPassword()
                        );

                var statement =
                        connection.prepareStatement(
                                sql
                        )
        ) {
            statement.setString(
                    1,
                    stationId
            );

            statement.setString(
                    2,
                    "VoltGrid E2E Station"
            );

            statement.executeUpdate();
        }
    }

    private void seedToken(
            AuthorizationFlowTestEnvironment environment,
            String rawToken,
            String status,
            Instant expiresAt
    ) throws Exception {

        var postgres =
                environment.authorizationPostgres();

        var sql =
                """
                INSERT INTO authorization_tokens (
                    id,
                    token_fingerprint,
                    status,
                    expires_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """;

        try (
                var connection =
                        DriverManager.getConnection(
                                postgres.getJdbcUrl(),
                                postgres.getUsername(),
                                postgres.getPassword()
                        );

                var statement =
                        connection.prepareStatement(
                                sql
                        )
        ) {
            statement.setObject(
                    1,
                    UUID.randomUUID()
            );

            statement.setString(
                    2,
                    fingerprint(
                            rawToken
                    )
            );

            statement.setString(
                    3,
                    status
            );

            if (expiresAt == null) {
                statement.setNull(
                        4,
                        Types.TIMESTAMP_WITH_TIMEZONE
                );
            } else {
                statement.setObject(
                        4,
                        OffsetDateTime.ofInstant(
                                expiresAt,
                                ZoneOffset.UTC
                        )
                );
            }

            statement.executeUpdate();
        }
    }

    private String fingerprint(
            String rawToken
    ) throws Exception {

        var mac =
                Mac.getInstance(
                        "HmacSHA256"
                );

        mac.init(
                new SecretKeySpec(
                        AuthorizationFlowTestEnvironment
                                .TEST_HMAC_KEY
                                .getBytes(
                                        StandardCharsets.UTF_8
                                ),
                        "HmacSHA256"
                )
        );

        return HexFormat.of()
                .formatHex(
                        mac.doFinal(
                                rawToken.getBytes(
                                        StandardCharsets.UTF_8
                                )
                        )
                );
    }

    private void send(
            WebSocket webSocket,
            String message
    ) {
        webSocket.sendText(
                message,
                true
        ).join();
    }

    private void assertCallResultStatus(
            String response,
            String messageId,
            String status
    ) {
        var compact =
                response.replaceAll(
                        "\\s+",
                        ""
                );

        assertTrue(
                compact.startsWith(
                        "[3,\"" + messageId + "\""
                ),
                () ->
                        "Expected OCPP CALLRESULT for "
                                + messageId
                                + " but received: "
                                + response
        );

        assertTrue(
                compact.contains(
                        "\"status\":\""
                                + status
                                + "\""
                ),
                () ->
                        "Expected status "
                                + status
                                + " but received: "
                                + response
        );
    }

    private static final class QueueingWebSocketListener
            implements WebSocket.Listener {

        private final LinkedBlockingQueue<String> messages =
                new LinkedBlockingQueue<>();

        private final AtomicReference<Throwable> failure =
                new AtomicReference<>();

        private final StringBuilder currentMessage =
                new StringBuilder();

        @Override
        public void onOpen(
                WebSocket webSocket
        ) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(
                WebSocket webSocket,
                CharSequence data,
                boolean last
        ) {
            synchronized (currentMessage) {
                currentMessage.append(data);

                if (last) {
                    messages.offer(
                            currentMessage.toString()
                    );

                    currentMessage.setLength(0);
                }
            }

            webSocket.request(1);

            return null;
        }

        @Override
        public void onError(
                WebSocket webSocket,
                Throwable error
        ) {
            failure.set(error);
        }

        String awaitMessage(
                Duration timeout
        ) throws InterruptedException {

            var message =
                    messages.poll(
                            timeout.toMillis(),
                            TimeUnit.MILLISECONDS
                    );

            if (message != null) {
                return message;
            }

            var error =
                    failure.get();

            if (error != null) {
                fail(
                        "WebSocket failed",
                        error
                );
            }

            fail(
                    "Timed out waiting for WebSocket response"
            );

            return null;
        }
    }
}