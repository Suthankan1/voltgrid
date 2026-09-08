package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.ConnectorStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JpaStationConnectorReaderTests {

    @Mock
    private StationConnectorJpaRepository repository;

    private JpaStationConnectorReader reader;

    @BeforeEach
    void setUp() {
        reader = new JpaStationConnectorReader(
                repository
        );
    }

    @Test
    void shouldReturnStationConnectorsInStableOrder() {
        var connector2 =
                new StationConnectorEntity(
                        new StationConnectorId(
                                "STATION-003",
                                1,
                                2
                        ),
                        ConnectorStatus.FAULTED,
                        Instant.parse(
                                "2026-09-08T06:35:00Z"
                        )
                );

        var connector1 =
                new StationConnectorEntity(
                        new StationConnectorId(
                                "STATION-003",
                                1,
                                1
                        ),
                        ConnectorStatus.AVAILABLE,
                        Instant.parse(
                                "2026-09-08T06:30:00Z"
                        )
                );

        when(
                repository.findByIdStationId(
                        "STATION-003"
                )
        ).thenReturn(
                List.of(
                        connector2,
                        connector1
                )
        );

        var connectors =
                reader.findByStationId(
                        "STATION-003"
                );

        assertThat(connectors)
                .hasSize(2);

        assertThat(
                connectors.get(0).connectorId()
        ).isEqualTo(1);

        assertThat(
                connectors.get(1).connectorId()
        ).isEqualTo(2);
    }
}