package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationConnectivityServiceTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private StationWriter stationWriter;

    private StationConnectivityService service;

    @BeforeEach
    void setUp() {
        service = new StationConnectivityService(
                stationReader,
                stationWriter
        );
    }

    @Test
    void shouldMarkStationOnline() {
        when(stationReader.findById("STATION-003"))
                .thenReturn(Optional.of(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.OFFLINE
                        )
                ));

        service.markOnline("STATION-003");

        verify(stationWriter).save(
                new ChargingStation(
                        "STATION-003",
                        "Galle Central",
                        StationStatus.ONLINE
                )
        );
    }
}