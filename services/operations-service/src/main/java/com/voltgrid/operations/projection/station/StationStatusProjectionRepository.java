package com.voltgrid.operations.projection.station;

import org.springframework.data.domain.Limit;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.data.domain.Window;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StationStatusProjectionRepository
        extends JpaRepository<
        StationStatusProjectionEntity,
        String
        > {

    Window<StationStatusProjectionEntity>
    findAllByOrderByStationIdAsc(
            ScrollPosition position,
            Limit limit
    );

    Window<StationStatusProjectionEntity>
    findByCurrentStatusOrderByStationIdAsc(
            String currentStatus,
            ScrollPosition position,
            Limit limit
    );

    Optional<StationStatusProjectionEntity> findByStationIdAndOrganizationId(
            String stationId,
            String organizationId
    );

    Window<StationStatusProjectionEntity> findByOrganizationIdOrderByStationIdAsc(
            String organizationId,
            ScrollPosition position,
            Limit limit
    );

    Window<StationStatusProjectionEntity> findByOrganizationIdAndCurrentStatusOrderByStationIdAsc(
            String organizationId,
            String currentStatus,
            ScrollPosition position,
            Limit limit
    );
}
