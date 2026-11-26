package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StationRegistrationService {

    private final StationReader stationReader;
    private final StationWriter stationWriter;

    public StationRegistrationService(
            StationReader stationReader,
            StationWriter stationWriter
    ) {
        this.stationReader = stationReader;
        this.stationWriter = stationWriter;
    }

    @Transactional
    public ChargingStation register(String id, String name) {
        return register(id, name, "org_voltgrid_default", null);
    }

    @Transactional
    public ChargingStation register(String id, String name, String organizationId, String siteId) {
        if (stationReader.findById(id).isPresent()) {
            throw new StationAlreadyExistsException(id);
        }

        var station = new ChargingStation(
                id,
                name,
                StationStatus.OFFLINE,
                null,
                organizationId != null ? organizationId : "org_voltgrid_default",
                siteId
        );

        stationWriter.save(station);

        return station;
    }
}
