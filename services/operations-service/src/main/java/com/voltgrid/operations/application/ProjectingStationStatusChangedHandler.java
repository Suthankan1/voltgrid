package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class ProjectingStationStatusChangedHandler
        implements StationStatusChangedHandler {

    private static final Logger log = LoggerFactory.getLogger(ProjectingStationStatusChangedHandler.class);
    private static final String EVENT_TYPE = "StationStatusChanged";

    private final StationStatusProjectionRepository projectionRepository;
    private final ProcessedEventReceiptRepository receiptRepository;
    private final MeterRegistry meterRegistry;
    private final AtomicReference<Double> currentLagSeconds = new AtomicReference<>(0.0);

    @Autowired
    public ProjectingStationStatusChangedHandler(
            StationStatusProjectionRepository projectionRepository,
            ProcessedEventReceiptRepository receiptRepository,
            @Autowired(required = false) MeterRegistry meterRegistry
    ) {
        this.projectionRepository = projectionRepository;
        this.receiptRepository = receiptRepository;
        this.meterRegistry = meterRegistry;

        if (meterRegistry != null) {
            meterRegistry.gauge("voltgrid.operations.projection.lag_seconds", currentLagSeconds, ref -> ref.get());
        }
    }

    public ProjectingStationStatusChangedHandler(
            StationStatusProjectionRepository projectionRepository,
            ProcessedEventReceiptRepository receiptRepository
    ) {
        this(projectionRepository, receiptRepository, null);
    }

    @Override
    @Transactional
    public void handle(
            StationStatusChangedEvent event
    ) {
        var processedAt = Instant.now();

        if (event.occurredAt() != null) {
            double lag = Math.max(0, Duration.between(event.occurredAt(), processedAt).toMillis()) / 1000.0;
            currentLagSeconds.set(lag);
        }

        var receiptInserted = receiptRepository.insertIfAbsent(
                event.eventId(),
                EVENT_TYPE,
                processedAt
        );

        if (receiptInserted == 0) {
            incrementMetric("duplicate");
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
            incrementMetric("inserted");
            return;
        }

        var projection = existing.orElseThrow();

        if (projection.getOrganizationId() != null
                && !projection.getOrganizationId().equals(targetOrg)) {
            log.error("Rejected cross-tenant status update event: station={} existingOrg={} eventOrg={}",
                    event.stationId(), projection.getOrganizationId(), targetOrg);
            incrementMetric("rejected");
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
            incrementMetric("updated");
        } else {
            incrementMetric("superseded");
        }
    }

    private void incrementMetric(String status) {
        if (meterRegistry != null) {
            meterRegistry.counter("voltgrid.operations.projection.applied", "status", status).increment();
        }
    }
}
