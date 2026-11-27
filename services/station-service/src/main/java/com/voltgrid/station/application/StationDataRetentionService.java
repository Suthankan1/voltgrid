package com.voltgrid.station.application;

import com.voltgrid.station.messaging.outbox.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class StationDataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(StationDataRetentionService.class);

    private final OutboxEventRepository outboxEventRepository;

    public StationDataRetentionService(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Transactional
    public int purgePublishedOutboxEvents(Duration retentionWindow) {
        if (retentionWindow == null || retentionWindow.isNegative()) {
            throw new IllegalArgumentException("retentionWindow must be positive");
        }
        Instant cutoff = Instant.now().minus(retentionWindow);
        return purgePublishedOutboxEvents(cutoff);
    }

    @Transactional
    public int purgePublishedOutboxEvents(Instant cutoff) {
        if (cutoff == null) {
            throw new IllegalArgumentException("cutoff must not be null");
        }
        int purged = outboxEventRepository.deleteByPublishedAtBefore(cutoff);
        log.info("Purged {} published outbox events older than {}", purged, cutoff);
        return purged;
    }
}
