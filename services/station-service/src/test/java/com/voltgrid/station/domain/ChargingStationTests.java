package com.voltgrid.station.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChargingStationTests {

    @Test
    void shouldCreateChargingStation() {
        ChargingStation station =
                new ChargingStation("STATION-001", "Colombo Central", StationStatus.ONLINE);

        assertEquals("STATION-001", station.id());
        assertEquals("Colombo Central", station.name());
        assertEquals(StationStatus.ONLINE, station.status());
    }
}