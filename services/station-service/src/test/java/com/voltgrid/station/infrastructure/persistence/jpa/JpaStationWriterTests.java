package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JpaStationWriterTests {

    @Mock
    private ChargingStationJpaRepository repository;

    @Test
    void shouldPersistStationAsJpaEntity() {
        var writer = new JpaStationWriter(repository);

        var station = new ChargingStation(
                "STATION-003",
                "Galle Central",
                StationStatus.OFFLINE
        );

        writer.save(station);

        var captor = ArgumentCaptor.forClass(
                ChargingStationEntity.class
        );

        verify(repository).save(captor.capture());

        var entity = captor.getValue();

        assertThat(entity.getId()).isEqualTo("STATION-003");
        assertThat(entity.getName()).isEqualTo("Galle Central");
        assertThat(entity.getStatus()).isEqualTo(StationStatus.OFFLINE);
    }
}