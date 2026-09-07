package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    public void markOnline(String stationId) {
        var station = stationReader.findById(stationId)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Station not found: " + stationId
                        )
                );

        stationWriter.save(
                new ChargingStation(
                        station.id(),
                        station.name(),
                        StationStatus.ONLINE
                )
        );
    }
}