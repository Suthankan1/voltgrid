package com.voltgrid.operations.projection.station;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StationStatusProjectionRepository
        extends JpaRepository<
                StationStatusProjectionEntity,
                String
                > {
}