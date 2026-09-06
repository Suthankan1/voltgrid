package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class StationDataProvider implements StationReader {

    private final Map<String, ChargingStation> stations = Map.of(
            "STATION-001",
            new ChargingStation("STATION-001", "Colombo Central"),

            "STATION-002",
            new ChargingStation("STATION-002", "Kandy Central")
    );

    @Override
    public ChargingStation findById(String id) {
        return stations.get(id);
    }
}