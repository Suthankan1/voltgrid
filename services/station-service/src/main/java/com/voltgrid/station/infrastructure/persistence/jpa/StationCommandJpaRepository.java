package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.domain.CommandStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StationCommandJpaRepository extends JpaRepository<StationCommandEntity, UUID> {

    @Modifying
    @Query("""
            update StationCommandEntity command
            set command.status = :status, command.responsePayload = :responsePayload
            where command.id = :id and command.status = :expectedStatus
            """)
    int updateDispatchResult(UUID id, CommandStatus expectedStatus, CommandStatus status, String responsePayload);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<StationCommandEntity> findByStationIdAndMessageId(String stationId, String messageId);

    Optional<StationCommandEntity> findByStationIdAndIdempotencyKey(String stationId, String idempotencyKey);

    Page<StationCommandEntity> findByStationId(String stationId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<StationCommandEntity> findFirst2ByStationIdAndActionAndRemoteStartIdOrderById(
            String stationId, String action, Integer remoteStartId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<StationCommandEntity> findFirst2ByStationIdAndActionAndTransactionIdOrderById(
            String stationId, String action, String transactionId);

    @Modifying
    @Query("""
            update StationCommandEntity command
            set command.status = :status, command.responsePayload = :responsePayload
            where command.stationId = :stationId and command.status = :expectedStatus
            """)
    int updateDisconnectedCommands(
            String stationId, CommandStatus expectedStatus, CommandStatus status, String responsePayload);

    @Modifying
    @Query("""
            update StationCommandEntity command
            set command.status = :status
            where command.stationId = :stationId and command.status in :expectedStatuses
                and command.expiresAt <= :now
            """)
    int updateExpiredCommands(
            String stationId, List<CommandStatus> expectedStatuses, CommandStatus status, Instant now);
}
