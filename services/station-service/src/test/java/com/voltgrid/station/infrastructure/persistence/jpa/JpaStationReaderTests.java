package com.voltgrid.station.infrastructure.persistence.jpa;

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
class JpaStationReaderTests {

    @Mock
    private ChargingStationJpaRepository repository;

    private JpaStationReader reader;

    @BeforeEach
    void setUp() {
        reader = new JpaStationReader(repository);
    }

    @Test
    void shouldMapEntityWhenFindingStationById() {
        var entity = new ChargingStationEntity(
                "station-001",
                "Station 001",
                StationStatus.ONLINE
        );

        when(repository.findById("station-001"))
                .thenReturn(Optional.of(entity));

        var result = reader.findById("station-001");

        assertThat(result).contains(
                new ChargingStation(
                        "station-001",
                        "Station 001",
                        StationStatus.ONLINE
                )
        );
    }

    @Test
    void shouldMapEntitiesWhenFindingAllStations() {
        when(repository.findAll()).thenReturn(List.of(
                new ChargingStationEntity(
                        "station-001",
                        "Station 001",
                        StationStatus.ONLINE
                ),
                new ChargingStationEntity(
                        "station-002",
                        "Station 002",
                        StationStatus.OFFLINE
                )
        ));

        var result = reader.findAll();

        assertThat(result).containsExactly(
                new ChargingStation(
                        "station-001",
                        "Station 001",
                        StationStatus.ONLINE
                ),
                new ChargingStation(
                        "station-002",
                        "Station 002",
                        StationStatus.OFFLINE
                )
        );
    }
}