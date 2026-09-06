package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StationQueryServiceTests {

    @Autowired
    private StationQueryService stationQueryService;

    @Test
    void shouldFindStationById() {
        ChargingStation station =
                stationQueryService.findById("STATION-001");

        assertNotNull(station);
        assertEquals("STATION-001", station.id());
        assertEquals("Colombo Central", station.name());
    }

    @Test
    void shouldReturnNullWhenStationDoesNotExist() {
        ChargingStation station =
                stationQueryService.findById("UNKNOWN");

        assertNull(station);
    }
}