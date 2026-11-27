package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
public class ProjectingStationStatusChangedHandler
        implements StationStatusChangedHandler {

    private static final Logger log = LoggerFactory.getLogger(ProjectingStationStatusChangedHandler.class);
    private static final String EVENT_TYPE = "StationStatusChanged";

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
        var processedAt = Instant.now();

        var receiptInserted = receiptRepository.insertIfAbsent(
                event.eventId(),
                EVENT_TYPE,
                processedAt
        );

        if (receiptInserted == 0) {
            return;
        }

        var existing = projectionRepository.findById(event.stationId());

        String targetOrg = event.organizationId();
        if (targetOrg != null && targetOrg.isBlank()) {
            targetOrg = null;
        }

        long eventSeq = event.sequenceNumber() != null ? event.sequenceNumber() : 0L;

        if (existing.isEmpty()) {
            projectionRepository.save(
                    new StationStatusProjectionEntity(
                            event.stationId(),
                            targetOrg,
                            event.currentStatus(),
                            event.eventId(),
                            event.occurredAt(),
                            processedAt,
                            eventSeq
                    )
            );
            return;
        }

        var projection = existing.orElseThrow();

        if (projection.getOrganizationId() != null
                && !projection.getOrganizationId().equals(targetOrg)) {
            log.error("Rejected cross-tenant status update event: station={} existingOrg={} eventOrg={}",
                    event.stationId(), projection.getOrganizationId(), targetOrg);
            return;
        }

        if (projection.apply(
                event.eventId(),
                event.currentStatus(),
                event.occurredAt(),
                processedAt,
                eventSeq
        )) {
            if (projection.getOrganizationId() == null) {
                projection.setOrganizationId(targetOrg);
            }
            projectionRepository.save(projection);
        }
    }
}
