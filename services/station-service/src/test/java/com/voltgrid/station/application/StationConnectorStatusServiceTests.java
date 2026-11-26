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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationConnectorStatusServiceTests {

    @Mock
    private StationConnectorReader connectorReader;

    @Mock
    private StationConnectorWriter connectorWriter;

    private StationConnectorStatusService service;

    @BeforeEach
    void setUp() {
        service = new StationConnectorStatusService(
                connectorReader,
                connectorWriter
        );
    }

    @Test
    void shouldPersistConnectorStatus() {
        var timestamp = Instant.parse(
                "2026-09-08T05:30:00Z"
        );

        when(connectorReader.findByStationId("STATION-003"))
                .thenReturn(List.of());

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

    @Test
    void shouldIgnoreStaleOutOfOrderConnectorStatus() {
        var newerTimestamp = Instant.parse(
                "2026-09-08T05:30:00Z"
        );
        var olderTimestamp = Instant.parse(
                "2026-09-08T05:25:00Z"
        );

        var existingConnector = new StationConnector(
                "STATION-003",
                1,
                1,
                ConnectorStatus.OCCUPIED,
                newerTimestamp
        );

        when(connectorReader.findByStationId("STATION-003"))
                .thenReturn(List.of(existingConnector));

        service.updateStatus(
                "STATION-003",
                1,
                1,
                ConnectorStatus.AVAILABLE,
                olderTimestamp
        );

        verify(connectorWriter, never()).save(any());
    }

    @Test
    void shouldAllowConnectorStatusUpdateWhenTimestampIsEqualToExisting() {
        var exactTimestamp = Instant.parse("2026-09-08T05:30:00Z");

        var existingConnector = new StationConnector(
                "STATION-003",
                1,
                1,
                ConnectorStatus.AVAILABLE,
                exactTimestamp
        );

        when(connectorReader.findByStationId("STATION-003"))
                .thenReturn(List.of(existingConnector));

        service.updateStatus(
                "STATION-003",
                1,
                1,
                ConnectorStatus.OCCUPIED,
                exactTimestamp
        );

        verify(connectorWriter).save(
                new StationConnector(
                        "STATION-003",
                        1,
                        1,
                        ConnectorStatus.OCCUPIED,
                        exactTimestamp
                )
        );
    }

    @Test
    void shouldIsolateStatusUpdatesAcrossDistinctConnectors() {
        var timestamp = Instant.parse("2026-09-08T05:30:00Z");

        var connector1 = new StationConnector(
                "STATION-003",
                1,
                1,
                ConnectorStatus.OCCUPIED,
                timestamp
        );

        when(connectorReader.findByStationId("STATION-003"))
                .thenReturn(List.of(connector1));

        // Update connector 2 (not yet recorded in DB)
        service.updateStatus(
                "STATION-003",
                1,
                2,
                ConnectorStatus.AVAILABLE,
                timestamp.minusSeconds(100) // Older than connector 1, but connector 2 doesn't exist yet
        );

        verify(connectorWriter).save(
                new StationConnector(
                        "STATION-003",
                        1,
                        2,
                        ConnectorStatus.AVAILABLE,
                        timestamp.minusSeconds(100)
                )
        );
    }
}