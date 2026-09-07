package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class StationLivenessService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;

    public StationLivenessService(
            StationReader stationReader,
            StationWriter stationWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
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

        staleStations.forEach(station ->
                stationWriter.save(
                        new ChargingStation(
                                station.id(),
                                station.name(),
                                StationStatus.OFFLINE,
                                station.lastSeenAt()
                        )
                )
        );

        return staleStations.size();
    }
}