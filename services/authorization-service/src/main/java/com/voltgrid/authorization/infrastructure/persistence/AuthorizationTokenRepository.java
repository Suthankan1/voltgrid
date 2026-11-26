package com.voltgrid.authorization.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuthorizationTokenRepository
        extends JpaRepository<AuthorizationTokenEntity, UUID> {

    Optional<AuthorizationTokenEntity> findByTokenFingerprint(
            String tokenFingerprint
    );

    List<AuthorizationTokenEntity> findByTokenFingerprintIn(
            Collection<String> fingerprints
    );
}
