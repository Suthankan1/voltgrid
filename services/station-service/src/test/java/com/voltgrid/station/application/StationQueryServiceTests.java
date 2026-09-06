package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class StationQueryServiceTests {

    @Autowired
    private StationQueryService stationQueryService;

    @Test
    void shouldProvideSampleStation() {
        assertNotNull(stationQueryService);

        ChargingStation station =
                stationQueryService.getSampleStation();

        assertEquals("STATION-001", station.id());
        assertEquals("Colombo Central", station.name());
    }
}