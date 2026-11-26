package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingStation;

import java.util.List;
import java.util.Optional;

public interface StationReader {

    Optional<ChargingStation> findById(String id);

    List<ChargingStation> findAll();

    default List<ChargingStation> findByOrganizationId(String organizationId) {
        return findAll().stream()
                .filter(s -> organizationId != null && organizationId.equals(s.organizationId()))
                .toList();
    }

    default Optional<ChargingStation> findByIdAndOrganizationId(String id, String organizationId) {
        return findById(id)
                .filter(s -> organizationId != null && organizationId.equals(s.organizationId()));
    }
}
