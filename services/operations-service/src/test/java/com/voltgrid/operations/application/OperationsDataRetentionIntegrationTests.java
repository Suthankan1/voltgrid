package com.voltgrid.operations.application;

import com.voltgrid.operations.PostgresTestConfiguration;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptEntity;
import com.voltgrid.operations.messaging.idempotency.ProcessedEventReceiptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = {
                "spring.kafka.listener.auto-startup=false",
                "voltgrid.security.require-auth=false"
        }
)
@Import(PostgresTestConfiguration.class)
class OperationsDataRetentionIntegrationTests {

    @Autowired
    private OperationsDataRetentionService retentionService;

    @Autowired
    private ProcessedEventReceiptRepository repository;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void shouldPurgeReceiptsOlderThanRetentionCutoff() {
        var now = Instant.now();
        var cutoff = now.minus(Duration.ofDays(90));

        var oldReceipt = new ProcessedEventReceiptEntity(
                UUID.randomUUID(),
                "StationStatusChanged",
                cutoff.minus(Duration.ofDays(5))
        );
        repository.save(oldReceipt);

        var recentReceipt = new ProcessedEventReceiptEntity(
                UUID.randomUUID(),
                "StationStatusChanged",
                now.minus(Duration.ofDays(10))
        );
        repository.save(recentReceipt);

        int purged = retentionService.purgeProcessedReceipts(cutoff);

        assertThat(purged).isEqualTo(1);
        assertThat(repository.existsById(oldReceipt.getEventId())).isFalse();
        assertThat(repository.existsById(recentReceipt.getEventId())).isTrue();
    }
}
