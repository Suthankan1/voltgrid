package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
public class ProjectingStationStatusChangedHandler
        implements StationStatusChangedHandler {

    private final StationStatusProjectionRepository repository;

    public ProjectingStationStatusChangedHandler(
            StationStatusProjectionRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void handle(
            StationStatusChangedEvent event
    ) {
        var updatedAt =
                Instant.now();

        var existing =
                repository.findById(
                        event.stationId()
                );

        if (existing.isEmpty()) {
            repository.save(
                    new StationStatusProjectionEntity(
                            event.stationId(),
                            event.currentStatus(),
                            event.eventId(),
                            event.occurredAt(),
                            updatedAt
                    )
            );

            return;
        }

        var projection =
                existing.orElseThrow();

        if (projection.apply(
                event.eventId(),
                event.currentStatus(),
                event.occurredAt(),
                updatedAt
        )) {
            repository.save(
                    projection
            );
        }
    }
}