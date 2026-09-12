package com.voltgrid.station.messaging.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                    """,
            nativeQuery = true
    )
    Optional<OutboxEventEntity>
    findNextUnpublishedForUpdate();
}