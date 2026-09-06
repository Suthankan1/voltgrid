package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

@Component
public class StationDataProvider implements StationReader {

    private final Map<String, ChargingStation> stations = Map.of(
            "STATION-001",
            new ChargingStation("STATION-001", "Colombo Central", StationStatus.ONLINE),

            "STATION-002",
            new ChargingStation("STATION-002", "Kandy Central", StationStatus.OFFLINE)
    );

    @Override
    public Optional<ChargingStation> findById(String id) {
        return Optional.ofNullable(stations.get(id));
    }
}