package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Service;

@Service
public class StationQueryService {

    private final StationReader stationReader;

    public StationQueryService(StationReader stationReader) {
        this.stationReader = stationReader;
    }

    public ChargingStation findById(String id) {
        return stationReader.findById(id);
    }
}