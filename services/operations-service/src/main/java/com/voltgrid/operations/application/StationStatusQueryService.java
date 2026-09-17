package com.voltgrid.operations.application;

import com.voltgrid.operations.api.graphql.StationOperationalStatus;
import com.voltgrid.operations.api.graphql.StationStatusView;
import com.voltgrid.operations.projection.station.StationStatusProjectionEntity;
import com.voltgrid.operations.projection.station.StationStatusProjectionRepository;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.data.domain.Window;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StationStatusQueryService {

    private static final int MIN_PAGE_SIZE =
            1;

    private static final int MAX_PAGE_SIZE =
            100;

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
                .findById(
                        stationId
                )
                .map(
                        this::toView
                )
                .orElse(
                        null
                );
    }

    @Transactional(readOnly = true)
    public Window<StationStatusView> findAll(
            ScrollPosition position,
            int count,
            StationOperationalStatus status
    ) {
        validatePageSize(
                count
        );

        var limit =
                Limit.of(
                        count
                );

        var projections =
                status == null
                        ? repository
                                .findAllByOrderByStationIdAsc(
                                        position,
                                        limit
                                )
                        : repository
                                .findByCurrentStatusOrderByStationIdAsc(
                                        status.name(),
                                        position,
                                        limit
                                );

        return projections.map(
                this::toView
        );
    }

    private void validatePageSize(
            int count
    ) {
        if (count < MIN_PAGE_SIZE
                || count > MAX_PAGE_SIZE) {
            throw new InvalidStationStatusPageSizeException(
                    MIN_PAGE_SIZE,
                    MAX_PAGE_SIZE
            );
        }
    }

    private StationStatusView toView(
            StationStatusProjectionEntity projection
    ) {
        return new StationStatusView(
                projection.getStationId(),
                projection.getCurrentStatus(),
                projection.getLastEventId()
                        .toString(),
                projection.getStatusChangedAt()
                        .toString(),
                projection.getUpdatedAt()
                        .toString()
        );
    }
}