package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import com.voltgrid.station.messaging.outbox.StationStatusOutboxWriter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class StationLivenessService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;
    private final StationStatusOutboxWriter outboxWriter;

    public StationLivenessService(
            StationReader stationReader,
            StationWriter stationWriter,
            StationStatusOutboxWriter outboxWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
        this.outboxWriter = outboxWriter;
    }

    @Transactional
    public int markStaleStationsOffline(
            Instant now,
            Duration staleAfter
    ) {
        var cutoff = now.minus(staleAfter);

        var staleStations = stationReader.findAll()
                .stream()
                .filter(station ->
                        station.status() == StationStatus.ONLINE
                )
                .filter(station ->
                        station.lastSeenAt() == null
                                || !station.lastSeenAt().isAfter(cutoff)
                )
                .toList();

        staleStations.forEach(station -> {
            stationWriter.save(
                    new ChargingStation(
                            station.id(),
                            station.name(),
                            StationStatus.OFFLINE,
                            station.lastSeenAt(),
                            station.organizationId(),
                            station.siteId()
                    )
            );
            outboxWriter.save(
                    new StationStatusChangedEvent(
                            UUID.randomUUID(),
                            station.id(),
                            StationStatus.ONLINE.name(),
                            StationStatus.OFFLINE.name(),
                            now,
                            station.organizationId()
                    ),
                    now
            );
        });

        return staleStations.size();
    }
}