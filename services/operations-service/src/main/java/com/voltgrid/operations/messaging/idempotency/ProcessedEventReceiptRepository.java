package com.voltgrid.operations.messaging.idempotency;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface ProcessedEventReceiptRepository
        extends JpaRepository<
                ProcessedEventReceiptEntity,
                UUID
                > {

    @Modifying
    @Query(
            value = """
                    INSERT INTO processed_event_receipts (
                        event_id,
                        event_type,
                        processed_at
                    )
                    VALUES (
                        :eventId,
                        :eventType,
                        :processedAt
                    )
                    ON CONFLICT (event_id) DO NOTHING
                    """,
            nativeQuery = true
    )
    int insertIfAbsent(
            @Param("eventId") UUID eventId,
            @Param("eventType") String eventType,
            @Param("processedAt") Instant processedAt
    );
}