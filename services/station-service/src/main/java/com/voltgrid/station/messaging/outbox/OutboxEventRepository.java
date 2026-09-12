package com.voltgrid.station.messaging.outbox;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OutboxEventRepository
        extends JpaRepository<
                OutboxEventEntity,
                UUID
        > {

    Optional<OutboxEventEntity>
    findFirstByPublishedAtIsNullOrderByCreatedAtAsc();
}