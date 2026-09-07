package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;

public interface StationWriter {

    void save(ChargingStation station);
}