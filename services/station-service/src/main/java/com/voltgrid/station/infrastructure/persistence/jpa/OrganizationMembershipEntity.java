package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "organization_memberships")
public class OrganizationMembershipEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "organization_id", nullable = false)
    private String organizationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected OrganizationMembershipEntity() {}

    public OrganizationMembershipEntity(
            String id,
            String organizationId,
            String userId,
            String userEmail,
            String role,
            String status
    ) {
        this.id = id;
        this.organizationId = organizationId;
        this.userId = userId;
        this.userEmail = userEmail;
        this.role = role;
        this.status = status != null ? status : "ACTIVE";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getUserId() { return userId; }
    public String getUserEmail() { return userEmail; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; this.updatedAt = Instant.now(); }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; this.updatedAt = Instant.now(); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
