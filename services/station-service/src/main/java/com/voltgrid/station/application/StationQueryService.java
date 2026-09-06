package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Service;

@Service
public class StationQueryService {

    private final StationDataProvider stationDataProvider;

    public StationQueryService(StationDataProvider stationDataProvider) {
        this.stationDataProvider = stationDataProvider;
    }

    public ChargingStation getSampleStation() {
        return stationDataProvider.getSampleStation();
    }
}