package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.CommandStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    Page<StationCommandEntity> findByStationId(String stationId, Pageable pageable);

    Optional<StationCommandEntity> findTopByStationIdAndActionAndStatusOrderByRequestedAtDesc(
            String stationId,
            String action,
            CommandStatus status
    );

    Optional<StationCommandEntity> findByStationIdAndActionAndRemoteStartIdAndStatus(
            String stationId,
            String action,
            Integer remoteStartId,
            CommandStatus status
    );

    Optional<StationCommandEntity> findByStationIdAndActionAndTransactionIdAndStatus(
            String stationId,
            String action,
            String transactionId,
            CommandStatus status
    );
}
