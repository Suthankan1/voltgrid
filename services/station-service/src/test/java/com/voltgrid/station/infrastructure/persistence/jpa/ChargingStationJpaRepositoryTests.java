package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ChargingStationJpaRepositoryTests {

    @Autowired
    private ChargingStationJpaRepository repository;

    @Test
    void shouldPersistAndReadStationFromPostgres() {
        var lastSeenAt = Instant.now();

        var station = new ChargingStationEntity(
                "TEST-STATION-JPA",
                "JPA Integration Test Station",
                StationStatus.ONLINE,
                lastSeenAt
        );

        repository.saveAndFlush(station);

        var savedStation = repository
                .findById("TEST-STATION-JPA")
                .orElseThrow();

        assertThat(savedStation.getId())
                .isEqualTo("TEST-STATION-JPA");

        assertThat(savedStation.getName())
                .isEqualTo(
                        "JPA Integration Test Station"
                );

        assertThat(savedStation.getStatus())
                .isEqualTo(StationStatus.ONLINE);

        assertThat(savedStation.getLastSeenAt())
                .isNotNull();
    }
}