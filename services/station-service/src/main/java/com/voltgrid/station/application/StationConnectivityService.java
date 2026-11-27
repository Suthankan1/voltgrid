package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.messaging.event.StationStatusChangedEvent;
import com.voltgrid.station.messaging.outbox.StationStatusOutboxWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class StationConnectivityService {

    private static final Logger log = LoggerFactory.getLogger(StationConnectivityService.class);

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
        this.stationStatusOutboxWriter = stationStatusOutboxWriter;
    }

    @Transactional
    public long registerConnection(
            String stationId,
            Instant seenAt
    ) {
        var station = findStation(stationId);

        var previousStatus = station.status();
        long newGeneration = station.connectionGeneration() + 1;
        long newSequence = station.statusSequenceNumber() + 1;

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.ONLINE,
                        seenAt,
                        station.organizationId(),
                        station.siteId(),
                        newGeneration,
                        newSequence
                )
        );

        if (previousStatus != StationStatus.ONLINE) {
            writeStatusChangedEvent(
                    station,
                    previousStatus,
                    StationStatus.ONLINE,
                    seenAt,
                    newSequence
            );
        }

        return newGeneration;
    }

    @Transactional
    public void markOnline(
            String stationId,
            Instant seenAt
    ) {
        registerConnection(stationId, seenAt);
    }

    @Transactional(readOnly = true)
    public boolean isGenerationActive(
            String stationId,
            long generation
    ) {
        return stationReader.findById(stationId)
                .map(s -> s.connectionGeneration() == generation)
                .orElse(false);
    }

    @Transactional
    public boolean markOfflineIfGenerationMatches(
            String stationId,
            long expectedGeneration
    ) {
        var station = findStation(stationId);

        if (station.connectionGeneration() != expectedGeneration) {
            log.info("Ignoring stale disconnect for station {} with generation {} (active generation is {})",
                    stationId, expectedGeneration, station.connectionGeneration());
            return false;
        }

        var previousStatus = station.status();
        var occurredAt = Instant.now();
        long newSequence = station.statusSequenceNumber() + 1;

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.OFFLINE,
                        station.lastSeenAt(),
                        station.organizationId(),
                        station.siteId(),
                        station.connectionGeneration(),
                        newSequence
                )
        );

        if (previousStatus != StationStatus.OFFLINE) {
            writeStatusChangedEvent(
                    station,
                    previousStatus,
                    StationStatus.OFFLINE,
                    occurredAt,
                    newSequence
            );
        }

        return true;
    }

    @Transactional
    public void markOffline(
            String stationId
    ) {
        var station = findStation(stationId);
        markOfflineIfGenerationMatches(stationId, station.connectionGeneration());
    }

    @Transactional
    public void recordActivity(
            String stationId,
            Instant seenAt
    ) {
        var station = findStation(stationId);

        var previousStatus = station.status();

        var currentStatus =
                previousStatus == StationStatus.OFFLINE
                        ? StationStatus.ONLINE
                        : previousStatus;

        long newSequence = previousStatus != currentStatus
                ? station.statusSequenceNumber() + 1
                : station.statusSequenceNumber();

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        currentStatus,
                        seenAt,
                        station.organizationId(),
                        station.siteId(),
                        station.connectionGeneration(),
                        newSequence
                )
        );

        if (previousStatus != currentStatus) {
            writeStatusChangedEvent(
                    station,
                    previousStatus,
                    currentStatus,
                    seenAt,
                    newSequence
            );
        }
    }

    private void writeStatusChangedEvent(
            ChargingStation station,
            StationStatus previousStatus,
            StationStatus currentStatus,
            Instant occurredAt,
            long sequenceNumber
    ) {
        stationStatusOutboxWriter.save(
                new StationStatusChangedEvent(
                        UUID.randomUUID(),
                        station.id(),
                        previousStatus.name(),
                        currentStatus.name(),
                        occurredAt,
                        station.organizationId(),
                        sequenceNumber
                ),
                occurredAt
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
