package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
public class ProjectingStationStatusChangedHandler
        implements StationStatusChangedHandler {

    private static final String EVENT_TYPE =
            "StationStatusChanged";

    private final StationStatusProjectionRepository projectionRepository;
    private final ProcessedEventReceiptRepository receiptRepository;

    public ProjectingStationStatusChangedHandler(
            StationStatusProjectionRepository projectionRepository,
            ProcessedEventReceiptRepository receiptRepository
    ) {
        this.projectionRepository = projectionRepository;
        this.receiptRepository = receiptRepository;
    }

    @Override
    @Transactional
    public void handle(
            StationStatusChangedEvent event
    ) {
        var processedAt =
                Instant.now();

        var receiptInserted =
                receiptRepository.insertIfAbsent(
                        event.eventId(),
                        EVENT_TYPE,
                        processedAt
                );

        if (receiptInserted == 0) {
            return;
        }

        var existing =
                projectionRepository.findById(
                        event.stationId()
                );

        if (existing.isEmpty()) {
            projectionRepository.save(
                    new StationStatusProjectionEntity(
                            event.stationId(),
                            event.currentStatus(),
                            event.eventId(),
                            event.occurredAt(),
                            processedAt
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
                processedAt
        )) {
            projectionRepository.save(
                    projection
            );
        }
    }
}