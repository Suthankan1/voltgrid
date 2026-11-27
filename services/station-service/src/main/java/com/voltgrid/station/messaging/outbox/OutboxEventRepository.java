package com.voltgrid.station.messaging.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface OutboxEventRepository
        extends JpaRepository<
                OutboxEventEntity,
                UUID
        > {

    @Query(
            value =
                    """
                    SELECT *
                    FROM outbox_events
                    WHERE published_at IS NULL
                      AND retry_count < 5
                      AND (last_attempted_at IS NULL OR last_attempted_at + (power(2, retry_count - 1) * interval '500 millisecond') <= NOW())
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                    """,
            nativeQuery = true
    )
    Optional<OutboxEventEntity>
    findNextUnpublishedForUpdate();

    long countByPublishedAtIsNull();

    long countByPublishedAtIsNullAndRetryCountGreaterThanEqual(int retryCount);

    @Modifying
    @Query(
            value =
                    """
                    UPDATE outbox_events
                    SET retry_count = 0,
                        last_error = NULL,
                        last_attempted_at = NULL
                    WHERE published_at IS NULL
                      AND retry_count >= 5
                    """,
            nativeQuery = true
    )
    int resetQuarantinedEvents();

    @Modifying
    @Query("""
            DELETE FROM OutboxEventEntity e
            WHERE e.publishedAt IS NOT NULL
              AND e.publishedAt < :cutoff
            """)
    int deleteByPublishedAtBefore(@Param("cutoff") Instant cutoff);
}
