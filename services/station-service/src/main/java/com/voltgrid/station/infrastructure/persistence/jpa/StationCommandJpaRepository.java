package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.CommandStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StationCommandJpaRepository extends JpaRepository<StationCommandEntity, UUID> {

    Optional<StationCommandEntity> findByStationIdAndMessageId(String stationId, String messageId);

    Optional<StationCommandEntity> findByStationIdAndIdempotencyKey(String stationId, String idempotencyKey);

    List<StationCommandEntity> findByStationIdAndStatus(String stationId, CommandStatus status);

    List<StationCommandEntity> findByStationIdOrderByRequestedAtDesc(String stationId);

    Optional<StationCommandEntity> findTopByStationIdAndActionAndStatusOrderByRequestedAtDesc(
            String stationId,
            String action,
            CommandStatus status
    );
}
