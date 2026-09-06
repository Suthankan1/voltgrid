package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;

import java.util.Optional;

public interface StationReader {

    Optional<ChargingStation> findById(String id);
}