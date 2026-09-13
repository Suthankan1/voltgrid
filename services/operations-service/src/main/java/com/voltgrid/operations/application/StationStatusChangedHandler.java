package com.voltgrid.operations.application;

import com.voltgrid.operations.messaging.event.StationStatusChangedEvent;

public interface StationStatusChangedHandler {

    void handle(
            StationStatusChangedEvent event
    );
}