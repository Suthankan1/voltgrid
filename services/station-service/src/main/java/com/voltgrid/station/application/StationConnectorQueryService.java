package com.voltgrid.station.application;

import com.voltgrid.station.domain.StationConnector;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StationConnectorQueryService {

    private final StationConnectorReader connectorReader;

    public StationConnectorQueryService(
            StationConnectorReader connectorReader
    ) {
        this.connectorReader = connectorReader;
    }

    public List<StationConnector> findByStationId(
            String stationId
    ) {
        return connectorReader.findByStationId(
                stationId
        );
    }
}