package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationRegistrationService;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.security.require-auth=false"
        }
)
@Import(PostgresTestConfiguration.class)
class GraphQlBoundedDataAccessIntegrationTests {

    @Autowired
    private StationGraphQlController stationController;

    @Autowired
    private StationRegistrationService registrationService;

    @Autowired
    private com.voltgrid.station.application.StationWriter stationWriter;

    @Autowired
    private com.voltgrid.station.application.StationReader stationReader;

    @BeforeEach
    void setupStations() {
        for (int i = 1; i <= 25; i++) {
            String stationId = String.format("STATION-PAGE-%03d", i);
            if (stationReader.findById(stationId).isEmpty()) {
                stationWriter.save(new com.voltgrid.station.domain.ChargingStation(
                        stationId,
                        "Paged Station " + i,
                        StationStatus.ONLINE,
                        null,
                        "org_voltgrid_default",
                        null,
                        0L,
                        0L
                ));
            }
        }
    }

    @Test
    void shouldReturnBoundedPaginatedStations() {
        // Page 0, Size 10
        var page0 = stationController.stations("org_voltgrid_default", 0, 10);
        assertThat(page0).hasSize(10);
        assertThat(page0.get(0).id()).isEqualTo("STATION-PAGE-001");

        // Page 1, Size 10
        var page1 = stationController.stations("org_voltgrid_default", 1, 10);
        assertThat(page1).hasSize(10);
        assertThat(page1.get(0).id()).isEqualTo("STATION-PAGE-011");

        // Page 2, Size 10 (remaining 5)
        var page2 = stationController.stations("org_voltgrid_default", 2, 10);
        assertThat(page2).hasSize(5);

        // Page 3, Size 10 (out of bounds)
        var page3 = stationController.stations("org_voltgrid_default", 3, 10);
        assertThat(page3).isEmpty();
    }

    @Test
    void shouldEnforceMaxUnpaginatedLimitWhenPaginationOmitted() {
        var stations = stationController.stations("org_voltgrid_default", null, null);
        assertThat(stations.size()).isLessThanOrEqualTo(500);
        assertThat(stations.size()).isGreaterThanOrEqualTo(25);
    }
}
