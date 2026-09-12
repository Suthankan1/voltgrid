package com.voltgrid.station.messaging.outbox;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        name = "voltgrid.kafka.outbox.relay-enabled",
        havingValue = "true"
)
public class OutboxRelayScheduler {

    private final OutboxRelayService outboxRelayService;
    private final int maxEventsPerPoll;

    public OutboxRelayScheduler(
            OutboxRelayService outboxRelayService,
            @Value(
                    "${voltgrid.kafka.outbox.max-events-per-poll}"
            )
            int maxEventsPerPoll
    ) {
        if (maxEventsPerPoll < 1) {
            throw new IllegalArgumentException(
                    "maxEventsPerPoll must be positive"
            );
        }

        this.outboxRelayService =
                outboxRelayService;

        this.maxEventsPerPoll =
                maxEventsPerPoll;
    }

    @Scheduled(
            fixedDelayString =
                    "${voltgrid.kafka.outbox.poll-delay-ms}"
    )
    public void relayAvailableEvents() {
        for (
                int processed = 0;
                processed < maxEventsPerPoll;
                processed++
        ) {
            var relayed =
                    outboxRelayService.relayNext();

            if (!relayed) {
                return;
            }
        }
    }
}