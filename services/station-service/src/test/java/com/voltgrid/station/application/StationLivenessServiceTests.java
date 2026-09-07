package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationLivenessServiceTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private StationWriter stationWriter;

    private StationLivenessService service;

    @BeforeEach
    void setUp() {
        service = new StationLivenessService(
                stationReader,
                stationWriter
        );
    }

    @Test
    void shouldMarkStaleOnlineStationOffline() {
        var now = Instant.parse(
                "2026-09-07T16:00:00Z"
        );

        var lastSeenAt = Instant.parse(
                "2026-09-07T15:45:00Z"
        );

        var station = new ChargingStation(
                "STATION-003",
                "Galle Central",
                StationStatus.ONLINE,
                lastSeenAt
        );

        when(stationReader.findAll())
                .thenReturn(List.of(station));

        var count = service.markStaleStationsOffline(
                now,
                Duration.ofMinutes(10)
        );

        assertThat(count).isEqualTo(1);

        verify(stationWriter).save(
                new ChargingStation(
                        "STATION-003",
                        "Galle Central",
                        StationStatus.OFFLINE,
                        lastSeenAt
                )
        );
    }

    @Test
    void shouldKeepRecentlySeenStationOnline() {
        var now = Instant.parse(
                "2026-09-07T16:00:00Z"
        );

        var station = new ChargingStation(
                "STATION-003",
                "Galle Central",
                StationStatus.ONLINE,
                Instant.parse(
                        "2026-09-07T15:55:00Z"
                )
        );

        when(stationReader.findAll())
                .thenReturn(List.of(station));

        var count = service.markStaleStationsOffline(
                now,
                Duration.ofMinutes(10)
        );

        assertThat(count).isZero();

        verify(
                stationWriter,
                never()
        ).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void shouldIgnoreAlreadyOfflineStation() {
        var now = Instant.parse(
                "2026-09-07T16:00:00Z"
        );

        var station = new ChargingStation(
                "STATION-003",
                "Galle Central",
                StationStatus.OFFLINE,
                Instant.parse(
                        "2026-09-07T15:00:00Z"
                )
        );

        when(stationReader.findAll())
                .thenReturn(List.of(station));

        var count = service.markStaleStationsOffline(
                now,
                Duration.ofMinutes(10)
        );

        assertThat(count).isZero();

        verify(
                stationWriter,
                never()
        ).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void shouldMarkOnlineStationWithoutLastSeenOffline() {
        var station = new ChargingStation(
                "STATION-001",
                "Station 001",
                StationStatus.ONLINE,
                null
        );

        when(stationReader.findAll())
                .thenReturn(List.of(station));

        var count = service.markStaleStationsOffline(
                Instant.parse(
                        "2026-09-07T16:00:00Z"
                ),
                Duration.ofMinutes(10)
        );

        assertThat(count).isEqualTo(1);

        verify(stationWriter).save(
                new ChargingStation(
                        "STATION-001",
                        "Station 001",
                        StationStatus.OFFLINE,
                        null
                )
        );
    }
}