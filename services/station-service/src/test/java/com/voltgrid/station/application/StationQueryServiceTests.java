package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationQueryServiceTests {

    @Mock
    private StationReader stationReader;

    private StationQueryService stationQueryService;

    @BeforeEach
    void setUp() {
        stationQueryService = new StationQueryService(stationReader);
    }

    @Test
    void shouldFindStationById() {
        var station = new ChargingStation(
                "STATION-001",
                "Colombo Central",
                StationStatus.ONLINE
        );

        when(stationReader.findById("STATION-001"))
                .thenReturn(Optional.of(station));

        var result = stationQueryService.findById("STATION-001");

        assertThat(result).contains(station);
    }

    @Test
    void shouldReturnEmptyWhenStationDoesNotExist() {
        when(stationReader.findById("UNKNOWN"))
                .thenReturn(Optional.empty());

        var result = stationQueryService.findById("UNKNOWN");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldFindAllStations() {
        var stations = List.of(
                new ChargingStation(
                        "STATION-001",
                        "Colombo Central",
                        StationStatus.ONLINE
                ),
                new ChargingStation(
                        "STATION-002",
                        "Kandy Central",
                        StationStatus.OFFLINE
                )
        );

        when(stationReader.findAll()).thenReturn(stations);

        var result = stationQueryService.findAll();

        assertThat(result).containsExactlyElementsOf(stations);
    }
}