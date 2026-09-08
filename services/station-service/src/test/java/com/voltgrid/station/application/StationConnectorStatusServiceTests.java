package com.voltgrid.station.application;

import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.StationConnector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class StationConnectorStatusServiceTests {

    @Mock
    private StationConnectorWriter connectorWriter;

    private StationConnectorStatusService service;

    @BeforeEach
    void setUp() {
        service = new StationConnectorStatusService(
                connectorWriter
        );
    }

    @Test
    void shouldPersistConnectorStatus() {
        var timestamp = Instant.parse(
                "2026-09-08T05:30:00Z"
        );

        service.updateStatus(
                "STATION-003",
                1,
                1,
                ConnectorStatus.AVAILABLE,
                timestamp
        );

        verify(connectorWriter).save(
                new StationConnector(
                        "STATION-003",
                        1,
                        1,
                        ConnectorStatus.AVAILABLE,
                        timestamp
                )
        );
    }
}