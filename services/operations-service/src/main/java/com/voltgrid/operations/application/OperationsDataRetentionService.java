package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class OperationsDataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(OperationsDataRetentionService.class);

    private final ProcessedEventReceiptRepository receiptRepository;

    public OperationsDataRetentionService(ProcessedEventReceiptRepository receiptRepository) {
        this.receiptRepository = receiptRepository;
    }

    @Transactional
    public int purgeProcessedReceipts(Duration retentionWindow) {
        if (retentionWindow == null || retentionWindow.isNegative()) {
            throw new IllegalArgumentException("retentionWindow must be positive");
        }
        Instant cutoff = Instant.now().minus(retentionWindow);
        return purgeProcessedReceipts(cutoff);
    }

    @Transactional
    public int purgeProcessedReceipts(Instant cutoff) {
        if (cutoff == null) {
            throw new IllegalArgumentException("cutoff must not be null");
        }
        int purged = receiptRepository.deleteByProcessedAtBefore(cutoff);
        log.info("Purged {} processed event receipts older than {}", purged, cutoff);
        return purged;
    }
}
