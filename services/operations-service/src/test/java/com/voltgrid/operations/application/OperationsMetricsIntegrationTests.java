package com.voltgrid.operations.application;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
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
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "management.endpoints.web.exposure.include=health,prometheus"
        }
)
@Import(PostgresTestConfiguration.class)
class OperationsMetricsIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private ProjectingStationStatusChangedHandler statusChangedHandler;

    @Autowired
    private MeterRegistry meterRegistry;

    @Test
    void shouldIncrementMetricsAndExposeViaPrometheusActuator() throws Exception {
        var eventId = UUID.randomUUID();
        var event = new StationStatusChangedEvent(
                eventId,
                "STATION-OBS-01",
                "org-test-123",
                "OFFLINE",
                "AVAILABLE",
                Instant.now(),
                1L
        );

        statusChangedHandler.handle(event);

        double appliedCount = meterRegistry.counter(
                "voltgrid.operations.projection.applied",
                "status", "inserted"
        ).count();
        assertThat(appliedCount).isGreaterThanOrEqualTo(1.0);

        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/actuator/prometheus"))
                .GET()
                .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body())
                .contains("voltgrid_operations_projection_applied_total")
                .contains("status=\"inserted\"")
                .contains("voltgrid_operations_projection_lag_seconds");
    }
}
