package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.application.StationStatusChangedHandler;
import com.voltgrid.operations.messaging.event.StationStatusChangedEventParser;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class StationStatusChangedConsumer {

    private final StationStatusChangedEventParser parser;
    private final StationStatusChangedHandler handler;

    public StationStatusChangedConsumer(
            StationStatusChangedEventParser parser,
            StationStatusChangedHandler handler
    ) {
        this.parser = parser;
        this.handler = handler;
    }

    @KafkaListener(
            topics = "${voltgrid.kafka.station-status-topic}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consume(
            String payload
    ) {
        var event =
                parser.parse(
                        payload
                );

        handler.handle(
                event
        );
    }
}