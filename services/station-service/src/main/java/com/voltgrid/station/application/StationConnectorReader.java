package com.voltgrid.station.application;

import com.voltgrid.station.domain.StationConnector;

import java.util.List;

public interface StationConnectorReader {

    List<StationConnector> findByStationId(
            String stationId
    );
}