package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingStationStatusChangedHandler
        implements StationStatusChangedHandler {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(
                    LoggingStationStatusChangedHandler.class
            );

    @Override
    public void handle(
            StationStatusChangedEvent event
    ) {
        LOGGER.info(
                "Station status changed: eventId={}, stationId={}, previousStatus={}, currentStatus={}",
                event.eventId(),
                event.stationId(),
                event.previousStatus(),
                event.currentStatus()
        );
    }
}