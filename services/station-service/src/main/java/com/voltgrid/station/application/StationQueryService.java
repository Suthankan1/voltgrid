package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Service;

@Service
public class StationQueryService {

    public ChargingStation getSampleStation() {
        return new ChargingStation(
                "STATION-001",
                "Colombo Central"
        );
    }
}