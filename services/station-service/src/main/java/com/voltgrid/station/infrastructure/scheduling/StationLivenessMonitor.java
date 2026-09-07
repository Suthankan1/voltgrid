package com.voltgrid.station.infrastructure.scheduling;

import com.voltgrid.station.application.StationLivenessService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class StationLivenessMonitor {

    private static final Logger log =
            LoggerFactory.getLogger(StationLivenessMonitor.class);

    private final StationLivenessService livenessService;
    private final Duration staleAfter;

    public StationLivenessMonitor(
            StationLivenessService livenessService,
            @Value("${voltgrid.station.stale-after-seconds:600}")
            long staleAfterSeconds
    ) {
        this.livenessService = livenessService;
        this.staleAfter = Duration.ofSeconds(staleAfterSeconds);
    }

    @Scheduled(
            fixedRateString =
                    "${voltgrid.station.liveness-check-interval:1m}",
            initialDelayString =
                    "${voltgrid.station.liveness-check-initial-delay:1m}"
    )
    public void checkForStaleStations() {
        var count = livenessService.markStaleStationsOffline(
                Instant.now(),
                staleAfter
        );

        if (count > 0) {
            log.info(
                    "Marked {} stale charging station(s) offline",
                    count
            );
        }
    }
}