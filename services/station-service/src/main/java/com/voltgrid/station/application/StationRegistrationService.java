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
        return register(id, name, null, null);
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
                organizationId,
                siteId
        );

        if (!stationWriter.insert(station)) {
            throw new StationAlreadyExistsException(id);
        }

        return station;
    }

    @Transactional
    public ChargingStation mapStation(String id, String organizationId, String siteId) {
        var existing = stationReader.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Station not found: " + id));

        var mapped = new ChargingStation(
                existing.id(),
                existing.name(),
                existing.status(),
                existing.lastSeenAt(),
                organizationId,
                siteId
        );

        stationWriter.save(mapped);
        return mapped;
    }
}
