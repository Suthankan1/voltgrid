package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ChargingTransactionJpaRepository
        extends JpaRepository<
                ChargingTransactionEntity,
                ChargingTransactionId
        > {

    List<ChargingTransactionEntity>
    findByIdStationIdOrderByStartedAtDesc(
            String stationId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            """
            SELECT transaction
            FROM ChargingTransactionEntity transaction
            WHERE transaction.id.stationId = :stationId
              AND transaction.id.transactionId = :transactionId
            """
    )
    Optional<ChargingTransactionEntity> findByIdForUpdate(
            @Param("stationId")
            String stationId,

            @Param("transactionId")
            String transactionId
    );

    @Modifying
    @Query(
            value =
                    """
                    INSERT INTO charging_transactions (
                        station_id,
                        transaction_id,
                        evse_id,
                        connector_id,
                        status,
                        started_at,
                        ended_at,
                        last_sequence_number
                    )
                    VALUES (
                        :stationId,
                        :transactionId,
                        :evseId,
                        :connectorId,
                        :status,
                        :startedAt,
                        NULL,
                        :lastSequenceNumber
                    )
                    ON CONFLICT (
                        station_id,
                        transaction_id
                    )
                    DO NOTHING
                    """,
            nativeQuery = true
    )
    int insertIfAbsent(
            @Param("stationId")
            String stationId,

            @Param("transactionId")
            String transactionId,

            @Param("evseId")
            int evseId,

            @Param("connectorId")
            int connectorId,

            @Param("status")
            String status,

            @Param("startedAt")
            Instant startedAt,

            @Param("lastSequenceNumber")
            int lastSequenceNumber
    );
}