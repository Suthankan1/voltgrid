package com.voltgrid.authorization.application;

import com.voltgrid.authorization.PostgresTestConfiguration;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.grpc.server.port=0",
                "management.endpoints.web.exposure.include=health,prometheus"
        }
)
@Import(PostgresTestConfiguration.class)
class AuthorizationMetricsIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private AuthorizationDecisionService decisionService;

    @Autowired
    private MeterRegistry meterRegistry;

    @Test
    void shouldIncrementMetricsAndExposeViaPrometheusActuator() throws Exception {
        var decision = decisionService.authorize("STATION-01", "NON_EXISTENT_TOKEN_123");
        assertThat(decision).isEqualTo(TokenAuthorizationDecision.UNKNOWN_TOKEN);

        double unknownCount = meterRegistry.counter(
                "voltgrid.authorization.decisions",
                "status", "UNKNOWN_TOKEN"
        ).count();
        assertThat(unknownCount).isGreaterThanOrEqualTo(1.0);

        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/actuator/prometheus"))
                .GET()
                .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body())
                .contains("voltgrid_authorization_decisions_total")
                .contains("status=\"UNKNOWN_TOKEN\"");
    }
}
