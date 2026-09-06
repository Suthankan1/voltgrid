package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Component;

@Component
public class StationDataProvider {

    public ChargingStation getSampleStation() {
        return new ChargingStation(
                "STATION-001",
                "Colombo Central"
        );
    }
}