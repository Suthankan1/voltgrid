package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class StationQueryService {

    private final StationReader stationReader;

    public StationQueryService(StationReader stationReader) {
        this.stationReader = stationReader;
    }

    public Optional<ChargingStation> findById(String id) {
        return stationReader.findById(id);
    }

    public List<ChargingStation> findAll() {
        return stationReader.findAll();
    }
}