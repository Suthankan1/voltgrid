package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class StationConnectivityService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;

    public StationConnectivityService(
            StationReader stationReader,
            StationWriter stationWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
    }

    @Transactional
    public void markOnline(
            String stationId,
            Instant seenAt
    ) {
        var station = findStation(stationId);

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.ONLINE,
                        seenAt
                )
        );
    }

    @Transactional
    public void recordActivity(
            String stationId,
            Instant seenAt
    ) {
        var station = findStation(stationId);

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
    public void markOffline(String stationId) {
        var station = findStation(stationId);

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
        return stationReader.findById(stationId)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Station not found: "
                                        + stationId
                        )
                );
    }
}