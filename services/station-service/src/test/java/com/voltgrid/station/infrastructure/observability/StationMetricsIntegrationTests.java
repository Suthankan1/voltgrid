package com.voltgrid.station.infrastructure.observability;

import com.voltgrid.station.support.PostgresTestConfiguration;
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
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "management.endpoints.web.exposure.include=health,prometheus"
        }
)
@Import(PostgresTestConfiguration.class)
class StationMetricsIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private MeterRegistry meterRegistry;

    @Test
    void shouldExposePrometheusActuatorAndDomainMetrics() throws Exception {
        meterRegistry.counter(
                "voltgrid.ocpp.handshake_failures",
                "reason", "unauthorized"
        ).increment();

        meterRegistry.timer("voltgrid.transaction.duration").record(Duration.ofSeconds(120));

        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/actuator/prometheus"))
                .GET()
                .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body())
                .contains("voltgrid_ocpp_active_connections")
                .contains("voltgrid_ocpp_handshake_failures_total")
                .contains("reason=\"unauthorized\"")
                .contains("voltgrid_transaction_duration_seconds");
    }
}
