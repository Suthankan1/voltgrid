package com.voltgrid.station.infrastructure.persistence.inmemory;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public class InMemoryStationDataProvider implements StationReader {

    private final Map<String, ChargingStation> stations = Map.of(
            "STATION-001",
            new ChargingStation(
                    "STATION-001",
                    "Colombo Central",
                    StationStatus.ONLINE
            ),

            "STATION-002",
            new ChargingStation(
                    "STATION-002",
                    "Kandy Central",
                    StationStatus.OFFLINE
            )
    );

    @Override
    public Optional<ChargingStation> findById(String id) {
        return Optional.ofNullable(stations.get(id));
    }

    @Override
    public List<ChargingStation> findAll() {
        return List.copyOf(stations.values());
    }
}