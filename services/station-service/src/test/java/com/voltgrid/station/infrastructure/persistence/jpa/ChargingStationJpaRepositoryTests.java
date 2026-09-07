package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ChargingStationJpaRepositoryTests {

    @Autowired
    private ChargingStationJpaRepository repository;

    @Test
    void shouldReadStationsFromPostgres() {
        var station = repository.findById("station-001");

        assertThat(station).isPresent();
        assertThat(station.get().getName()).isEqualTo("Station 001");
        assertThat(station.get().getStatus()).isEqualTo(StationStatus.ONLINE);
    }
}