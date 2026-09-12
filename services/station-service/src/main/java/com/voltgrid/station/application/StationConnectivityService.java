package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import com.voltgrid.station.messaging.outbox.StationStatusOutboxWriter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class StationConnectivityService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;
    private final StationStatusOutboxWriter stationStatusOutboxWriter;

    public StationConnectivityService(
            StationReader stationReader,
            StationWriter stationWriter,
            StationStatusOutboxWriter stationStatusOutboxWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
        this.stationStatusOutboxWriter =
                stationStatusOutboxWriter;
    }

    @Transactional
    public void markOnline(
            String stationId,
            Instant seenAt
    ) {
        var station =
                findStation(
                        stationId
                );

        var previousStatus =
                station.status();

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.ONLINE,
                        seenAt
                )
        );

        if (previousStatus != StationStatus.ONLINE) {
            stationStatusOutboxWriter.save(
                    new StationStatusChangedEvent(
                            UUID.randomUUID(),
                            station.id(),
                            previousStatus.name(),
                            StationStatus.ONLINE.name(),
                            seenAt
                    ),
                    seenAt
            );
        }
    }

    @Transactional
    public void recordActivity(
            String stationId,
            Instant seenAt
    ) {
        var station =
                findStation(
                        stationId
                );

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        station.status(),
                        seenAt
                )
        );
    }

    @Transactional
    public void markOffline(
            String stationId
    ) {
        var station =
                findStation(
                        stationId
                );

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.OFFLINE,
                        station.lastSeenAt()
                )
        );
    }

    private ChargingStation findStation(
            String stationId
    ) {
        return stationReader
                .findById(
                        stationId
                )
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Station not found: "
                                                + stationId
                                )
                );
    }
}