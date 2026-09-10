package com.voltgrid.authorization.infrastructure.persistence;

import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "authorization_tokens")
public class AuthorizationTokenEntity {

    @Id
    private UUID id;

    @Column(
            name = "token_fingerprint",
            nullable = false,
            unique = true,
            length = 64
    )
    private String tokenFingerprint;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 16
    )
    private AuthorizationTokenStatus status;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    protected AuthorizationTokenEntity() {
    }

    public AuthorizationTokenEntity(
            UUID id,
            String tokenFingerprint,
            AuthorizationTokenStatus status,
            Instant expiresAt,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.tokenFingerprint = tokenFingerprint;
        this.status = status;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getTokenFingerprint() {
        return tokenFingerprint;
    }

    public AuthorizationTokenStatus getStatus() {
        return status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}