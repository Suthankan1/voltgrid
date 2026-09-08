package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class StationConnectorJpaRepositoryTests {

    @Autowired
    private ChargingStationJpaRepository stationRepository;

    @Autowired
    private StationConnectorJpaRepository connectorRepository;

    @Test
    void shouldPersistConnectorStatus() {
        stationRepository.save(
                new ChargingStationEntity(
                        "TEST-STATION-CONNECTOR",
                        "Connector Test Station",
                        com.voltgrid.station.domain.StationStatus.ONLINE
                )
        );

        var id = new StationConnectorId(
                "TEST-STATION-CONNECTOR",
                1,
                1
        );

        var updatedAt =
                Instant.parse("2026-09-08T05:00:00Z");

        connectorRepository.saveAndFlush(
                new StationConnectorEntity(
                        id,
                        ConnectorStatus.AVAILABLE,
                        updatedAt
                )
        );

        var connector = connectorRepository
                .findById(id)
                .orElseThrow();

        assertThat(connector.getStatus())
                .isEqualTo(ConnectorStatus.AVAILABLE);

        assertThat(connector.getStatusUpdatedAt())
                .isEqualTo(updatedAt);
    }
}