package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationRegistrationServiceTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private StationWriter stationWriter;

    private StationRegistrationService service;

    @BeforeEach
    void setUp() {
        service = new StationRegistrationService(
                stationReader,
                stationWriter
        );
    }

    @Test
    void shouldRegisterNewStationAsOffline() {
        when(stationReader.findById("STATION-003"))
                .thenReturn(Optional.empty());

        var station = service.register(
                "STATION-003",
                "Galle Central"
        );

        var expected = new ChargingStation(
                "STATION-003",
                "Galle Central",
                StationStatus.OFFLINE
        );

        assertThat(station).isEqualTo(expected);
        verify(stationWriter).save(expected);
    }

    @Test
    void shouldRejectDuplicateStationId() {
        var existing = new ChargingStation(
                "STATION-001",
                "Colombo Central",
                StationStatus.ONLINE
        );

        when(stationReader.findById("STATION-001"))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(
                () -> service.register(
                        "STATION-001",
                        "Another Station"
                )
        )
                .isInstanceOf(StationAlreadyExistsException.class)
                .hasMessage("Station already exists: STATION-001");

        verifyNoInteractions(stationWriter);
    }
}