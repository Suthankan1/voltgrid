package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;

public interface StationWriter {

    boolean insert(ChargingStation station);

    void save(ChargingStation station);
}