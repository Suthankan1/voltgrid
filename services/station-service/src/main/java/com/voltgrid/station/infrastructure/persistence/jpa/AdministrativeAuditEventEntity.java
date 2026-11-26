package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "administrative_audit_events")
public class AdministrativeAuditEventEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "organization_id")
    private String organizationId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "actor_id", nullable = false)
    private String actorId;

    @Column(name = "actor_type", nullable = false)
    private String actorType = "USER";

    @Column(name = "resource_type", nullable = false)
    private String resourceType;

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "outcome", nullable = false)
    private String outcome = "SUCCESS";

    @Column(name = "correlation_id")
    private String correlationId;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected AdministrativeAuditEventEntity() {}

    public AdministrativeAuditEventEntity(
            String id,
            String organizationId,
            String eventType,
            String actorId,
            String actorType,
            String resourceType,
            String resourceId,
            String action,
            String outcome,
            String correlationId,
            String metadata
    ) {
        this.id = id;
        this.organizationId = organizationId;
        this.eventType = eventType;
        this.actorId = actorId;
        this.actorType = actorType != null ? actorType : "USER";
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.action = action;
        this.outcome = outcome != null ? outcome : "SUCCESS";
        this.correlationId = correlationId;
        this.metadata = metadata;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getEventType() { return eventType; }
    public String getActorId() { return actorId; }
    public String getActorType() { return actorType; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getAction() { return action; }
    public String getOutcome() { return outcome; }
    public String getCorrelationId() { return correlationId; }
    public String getMetadata() { return metadata; }
    public Instant getCreatedAt() { return createdAt; }
}
