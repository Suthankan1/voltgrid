package com.voltgrid.operations.projection.station;

import org.springframework.data.domain.Limit;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.data.domain.Window;
import org.springframework.data.jpa.repository.JpaRepository;

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
}