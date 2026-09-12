package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import com.voltgrid.station.messaging.outbox.StationStatusOutboxWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationConnectivityServiceTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private StationWriter stationWriter;

    @Mock
    private StationStatusOutboxWriter stationStatusOutboxWriter;

    private StationConnectivityService service;

    @BeforeEach
    void setUp() {
        service =
                new StationConnectivityService(
                        stationReader,
                        stationWriter,
                        stationStatusOutboxWriter
                );
    }

    @Test
    void shouldMarkStationOnlineAndRecordLastSeen() {
        var seenAt =
                Instant.parse(
                        "2026-09-07T15:30:00Z"
                );

        when(
                stationReader.findById(
                        "STATION-003"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.OFFLINE
                        )
                )
        );

        service.markOnline(
                "STATION-003",
                seenAt
        );

        verify(stationWriter)
                .save(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                seenAt
                        )
                );

        var eventCaptor =
                ArgumentCaptor.forClass(
                        StationStatusChangedEvent.class
                );

        verify(stationStatusOutboxWriter)
                .save(
                        eventCaptor.capture(),
                        eq(seenAt)
                );

        var event =
                eventCaptor.getValue();

        assertNotNull(
                event.eventId()
        );

        assertEquals(
                "STATION-003",
                event.stationId()
        );

        assertEquals(
                "OFFLINE",
                event.previousStatus()
        );

        assertEquals(
                "ONLINE",
                event.currentStatus()
        );

        assertEquals(
                seenAt,
                event.occurredAt()
        );
    }

    @Test
    void shouldNotCreateStatusEventWhenStationIsAlreadyOnline() {
        var previousSeenAt =
                Instant.parse(
                        "2026-09-07T15:25:00Z"
                );

        var seenAt =
                Instant.parse(
                        "2026-09-07T15:30:00Z"
                );

        when(
                stationReader.findById(
                        "STATION-003"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                previousSeenAt
                        )
                )
        );

        service.markOnline(
                "STATION-003",
                seenAt
        );

        verify(stationWriter)
                .save(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                seenAt
                        )
                );

        verify(
                stationStatusOutboxWriter,
                never()
        ).save(
                any(),
                any()
        );
    }

    @Test
    void shouldRecordStationActivityWithoutChangingStatus() {
        var previousSeenAt =
                Instant.parse(
                        "2026-09-07T15:30:00Z"
                );

        var seenAt =
                Instant.parse(
                        "2026-09-07T15:35:00Z"
                );

        when(
                stationReader.findById(
                        "STATION-003"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                previousSeenAt
                        )
                )
        );

        service.recordActivity(
                "STATION-003",
                seenAt
        );

        verify(stationWriter)
                .save(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                seenAt
                        )
                );

        verify(
                stationStatusOutboxWriter,
                never()
        ).save(
                any(),
                any()
        );
    }

    @Test
    void shouldMarkStationOfflineWithoutChangingLastSeen() {
        var lastSeenAt =
                Instant.parse(
                        "2026-09-07T16:00:00Z"
                );

        when(
                stationReader.findById(
                        "STATION-003"
                )
        ).thenReturn(
                Optional.of(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.ONLINE,
                                lastSeenAt
                        )
                )
        );

        service.markOffline(
                "STATION-003"
        );

        verify(stationWriter)
                .save(
                        new ChargingStation(
                                "STATION-003",
                                "Galle Central",
                                StationStatus.OFFLINE,
                                lastSeenAt
                        )
                );

        verify(
                stationStatusOutboxWriter,
                never()
        ).save(
                any(),
                any()
        );
    }
}