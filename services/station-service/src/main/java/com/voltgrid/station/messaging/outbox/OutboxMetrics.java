package com.voltgrid.station.messaging.outbox;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class OutboxMetrics {

    public OutboxMetrics(
            MeterRegistry meterRegistry,
            OutboxEventRepository outboxEventRepository
    ) {
        Gauge.builder(
                        "voltgrid.outbox.unpublished",
                        outboxEventRepository,
                        OutboxEventRepository::countByPublishedAtIsNull
                )
                .description(
                        "Number of unpublished transactional outbox events"
                )
                .register(
                        meterRegistry
                );
    }
}