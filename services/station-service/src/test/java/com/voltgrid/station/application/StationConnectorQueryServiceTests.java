package com.voltgrid.station.application;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;
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
class StationConnectorQueryServiceTests {

    @Mock
    private StationConnectorReader connectorReader;

    private StationConnectorQueryService service;

    @BeforeEach
    void setUp() {
        service = new StationConnectorQueryService(
                connectorReader
        );
    }

    @Test
    void shouldReturnConnectorsForStation() {
        var connector = new StationConnector(
                "STATION-003",
                1,
                1,
                ConnectorStatus.AVAILABLE,
                Instant.parse(
                        "2026-09-08T06:30:00Z"
                )
        );

        when(
                connectorReader.findByStationId(
                        "STATION-003"
                )
        ).thenReturn(
                List.of(connector)
        );

        var connectors =
                service.findByStationId(
                        "STATION-003"
                );

        assertThat(connectors)
                .containsExactly(connector);
    }
}