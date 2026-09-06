package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StationQueryServiceTests {

    @Autowired
    private StationQueryService stationQueryService;

    @Test
    void shouldFindStationById() {
        Optional<ChargingStation> result =
                stationQueryService.findById("STATION-001");

        assertTrue(result.isPresent());

        ChargingStation station = result.get();

        assertEquals("STATION-001", station.id());
        assertEquals("Colombo Central", station.name());
        assertEquals(StationStatus.ONLINE, station.status());
    }

    @Test
    void shouldReturnEmptyWhenStationDoesNotExist() {
        Optional<ChargingStation> result =
                stationQueryService.findById("UNKNOWN");

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldFindAllStations() {
        List<ChargingStation> stations =
                stationQueryService.findAll();

        assertEquals(2, stations.size());
    }
}