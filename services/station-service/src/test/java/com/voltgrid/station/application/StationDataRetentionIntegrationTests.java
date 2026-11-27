package com.voltgrid.station.application;

import com.voltgrid.station.messaging.outbox.OutboxEventEntity;
import com.voltgrid.station.messaging.outbox.OutboxEventRepository;
import com.voltgrid.station.support.PostgresTestConfiguration;
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
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.security.require-auth=false"
        }
)
@Import(PostgresTestConfiguration.class)
class StationDataRetentionIntegrationTests {

    @Autowired
    private StationDataRetentionService retentionService;

    @Autowired
    private OutboxEventRepository repository;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void shouldPurgeOnlyPublishedEventsOlderThanRetentionCutoff() {
        var now = Instant.now();
        var oldCutoff = now.minus(Duration.ofDays(30));

        // Event 1: published 45 days ago -> should be purged
        var oldPublishedEvent = new OutboxEventEntity(
                UUID.randomUUID(),
                "Station",
                "STATION-001",
                "StationStatusChanged",
                "{}",
                oldCutoff.minus(Duration.ofDays(15)),
                oldCutoff.minus(Duration.ofDays(15))
        );
        oldPublishedEvent.markPublished(oldCutoff.minus(Duration.ofDays(15)));
        repository.save(oldPublishedEvent);

        // Event 2: published 10 days ago -> should be retained
        var recentPublishedEvent = new OutboxEventEntity(
                UUID.randomUUID(),
                "Station",
                "STATION-001",
                "StationStatusChanged",
                "{}",
                now.minus(Duration.ofDays(10)),
                now.minus(Duration.ofDays(10))
        );
        recentPublishedEvent.markPublished(now.minus(Duration.ofDays(10)));
        repository.save(recentPublishedEvent);

        // Event 3: unpublished event from 45 days ago -> must NOT be purged!
        var oldUnpublishedEvent = new OutboxEventEntity(
                UUID.randomUUID(),
                "Station",
                "STATION-001",
                "StationStatusChanged",
                "{}",
                oldCutoff.minus(Duration.ofDays(15)),
                oldCutoff.minus(Duration.ofDays(15))
        );
        repository.save(oldUnpublishedEvent);

        int purgedCount = retentionService.purgePublishedOutboxEvents(oldCutoff);

        assertThat(purgedCount).isEqualTo(1);
        assertThat(repository.existsById(oldPublishedEvent.getId())).isFalse();
        assertThat(repository.existsById(recentPublishedEvent.getId())).isTrue();
        assertThat(repository.existsById(oldUnpublishedEvent.getId())).isTrue();
    }
}
