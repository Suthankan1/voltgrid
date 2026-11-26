package com.voltgrid.station.infrastructure.persistence.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "station_credentials")
public class StationCredentialEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "station_id", nullable = false)
    private String stationId;

    @Column(name = "credential_type", nullable = false)
    private String credentialType = "BASIC_AUTH";

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected StationCredentialEntity() {}

    public StationCredentialEntity(
            String id,
            String stationId,
            String credentialType,
            String passwordHash,
            String status
    ) {
        this.id = id;
        this.stationId = stationId;
        this.credentialType = credentialType != null ? credentialType : "BASIC_AUTH";
        this.passwordHash = passwordHash;
        this.status = status != null ? status : "ACTIVE";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getCredentialType() { return credentialType; }
    public String getPasswordHash() { return passwordHash; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}
