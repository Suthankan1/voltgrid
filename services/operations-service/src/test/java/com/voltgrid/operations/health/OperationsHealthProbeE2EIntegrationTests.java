package com.voltgrid.operations.health;

import com.voltgrid.operations.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(
        webEnvironment = RANDOM_PORT,
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@Import(PostgresTestConfiguration.class)
class OperationsHealthProbeE2EIntegrationTests {

    @LocalServerPort
    private int port;

    private final HttpClient httpClient =
            HttpClient.newHttpClient();

    @Test
    void shouldExposeLivenessProbeOnMainServerPort()
            throws Exception {

        var response =
                get(
                        "/livez"
                );

        assertThat(
                response.statusCode()
        ).isEqualTo(
                200
        );

        assertThat(
                response.body()
        ).contains(
                "\"status\":\"UP\""
        );
    }

    @Test
    void shouldExposeReadinessProbeOnMainServerPort()
            throws Exception {

        var response =
                get(
                        "/readyz"
                );

        assertThat(
                response.statusCode()
        ).isEqualTo(
                200
        );

        assertThat(
                response.body()
        ).contains(
                "\"status\":\"UP\""
        );
    }

    private HttpResponse<String> get(
            String path
    ) throws Exception {

        var request =
                HttpRequest
                        .newBuilder()
                        .uri(
                                URI.create(
                                        "http://localhost:"
                                                + port
                                                + path
                                )
                        )
                        .GET()
                        .build();

        return httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );
    }
}