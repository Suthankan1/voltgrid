package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Service;

@Service
public class StationRegistrationService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;

    public StationRegistrationService(
            StationReader stationReader,
            StationWriter stationWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
    }

    public ChargingStation register(String id, String name) {
        if (stationReader.findById(id).isPresent()) {
            throw new StationAlreadyExistsException(id);
        }

        var station = new ChargingStation(
                id,
                name,
                StationStatus.OFFLINE
        );

        stationWriter.save(station);

        return station;
    }
}