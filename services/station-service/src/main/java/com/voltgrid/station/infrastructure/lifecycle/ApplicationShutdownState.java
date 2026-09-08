package com.voltgrid.station.infrastructure.lifecycle;

import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class ApplicationShutdownState {

    private final AtomicBoolean shuttingDown =
            new AtomicBoolean(false);

    @EventListener(ContextClosedEvent.class)
    public void onContextClosed() {
        shuttingDown.set(true);
    }

    public boolean isShuttingDown() {
        return shuttingDown.get();
    }
}