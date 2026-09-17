package com.voltgrid.operations.application;

import com.voltgrid.operations.api.graphql.StationStatusView;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StationStatusQueryService {

    private final StationStatusProjectionRepository repository;

    public StationStatusQueryService(
            StationStatusProjectionRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public StationStatusView findByStationId(
            String stationId
    ) {
        return repository
                .findById(stationId)
                .map(
                        projection ->
                                new StationStatusView(
                                        projection.getStationId(),
                                        projection.getCurrentStatus(),
                                        projection.getLastEventId().toString(),
                                        projection.getStatusChangedAt().toString(),
                                        projection.getUpdatedAt().toString()
                                )
                )
                .orElse(
                        null
                );
    }
}