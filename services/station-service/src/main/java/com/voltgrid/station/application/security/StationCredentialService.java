package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialJpaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class StationCredentialService {

    private static final String HASH_ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATION_COUNT = 65_536;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_BYTES = 16;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final StationCredentialJpaRepository credentialRepository;
    private final AdministrativeAuditService auditService;
    private final OcppSessionFencer sessionFencer;

    @Autowired
    public StationCredentialService(
            StationCredentialJpaRepository credentialRepository,
            AdministrativeAuditService auditService,
            @Lazy OcppSessionFencer sessionFencer
    ) {
        this.credentialRepository = credentialRepository;
        this.auditService = auditService;
        this.sessionFencer = sessionFencer;
    }

    public StationCredentialService(
            StationCredentialJpaRepository credentialRepository,
            AdministrativeAuditService auditService
    ) {
        this(credentialRepository, auditService, null);
    }

    public boolean validateCredential(String stationId, String rawPassword) {
        return authenticateCredential(stationId, rawPassword).isPresent();
    }

    public Optional<String> authenticateCredential(String stationId, String rawPassword) {
        if (stationId == null || stationId.isBlank() || rawPassword == null
                || rawPassword.isBlank() || rawPassword.length() > 256) {
            return Optional.empty();
        }
        return credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE").stream()
                .filter(this::isActiveBasicCredential)
                .filter(credential -> verifyPasswordHash(rawPassword, credential.getPasswordHash()))
                .map(StationCredentialEntity::getId)
                .findFirst();
    }

    public boolean isCredentialActive(String stationId, String credentialId) {
        return credentialRepository.findById(credentialId)
                .filter(credential -> stationId.equals(credential.getStationId()))
                .filter(this::isActiveBasicCredential)
                .isPresent();
    }

    private boolean isActiveBasicCredential(StationCredentialEntity credential) {
        return "BASIC_AUTH".equals(credential.getCredentialType())
                && "ACTIVE".equals(credential.getStatus()) && credential.getRevokedAt() == null
                && (credential.getExpiresAt() == null || credential.getExpiresAt().isAfter(Instant.now()));
    }

    @Transactional
    public StationCredentialEntity provisionCredential(String stationId, String rawPassword, String actorId, String organizationId) {
        if (stationId == null || stationId.isBlank()) {
            throw new IllegalArgumentException("Station ID must not be blank");
        }
        if (rawPassword == null || rawPassword.length() < 8 || rawPassword.length() > 256) {
            throw new IllegalArgumentException("Station password must be between 8 and 256 characters");
        }

        String passwordHash = hashPassword(rawPassword);
        String credentialId = "cred_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        var credential = new StationCredentialEntity(
                credentialId,
                stationId,
                "BASIC_AUTH",
                passwordHash,
                "ACTIVE"
        );

        credentialRepository.save(credential);

        auditService.recordEvent(
                "CREDENTIAL_PROVISIONED",
                actorId != null ? actorId : "SYSTEM",
                "USER",
                organizationId,
                "CREDENTIAL",
                credentialId,
                "PROVISION",
                "SUCCESS",
                null,
                AdministrativeAuditService.metadata(Map.of("stationId", stationId))
        );

        return credential;
    }

    @Transactional
    public StationCredentialEntity rotateCredential(String stationId, String newPassword, String actorId, String organizationId) {
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 256) {
            throw new IllegalArgumentException("New password must be between 8 and 256 characters");
        }

        List<StationCredentialEntity> existing = credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE");
        for (var cred : existing) {
            cred.setStatus("ROTATED");
            credentialRepository.save(cred);
        }

        String passwordHash = hashPassword(newPassword);
        String credentialId = "cred_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        var newCredential = new StationCredentialEntity(
                credentialId,
                stationId,
                "BASIC_AUTH",
                passwordHash,
                "ACTIVE"
        );

        credentialRepository.save(newCredential);

        fenceAfterCommit(stationId, "Credential rotated");

        auditService.recordEvent(
                "CREDENTIAL_ROTATED",
                actorId != null ? actorId : "SYSTEM",
                "USER",
                organizationId,
                "CREDENTIAL",
                credentialId,
                "ROTATE",
                "SUCCESS",
                null,
                AdministrativeAuditService.metadata(Map.of("stationId", stationId))
        );

        return newCredential;
    }

    private void fenceAfterCommit(String stationId, String reason) {
        if (sessionFencer == null) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sessionFencer.terminateSession(stationId, reason);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                sessionFencer.terminateSession(stationId, reason);
            }
        });
    }

    @Transactional
    public boolean revokeCredential(String stationId, String actorId, String organizationId) {
        List<StationCredentialEntity> allCreds = credentialRepository.findByStationId(stationId);
        List<StationCredentialEntity> toRevoke = allCreds.stream()
                .filter(c -> "ACTIVE".equals(c.getStatus()) || "ROTATED".equals(c.getStatus()))
                .toList();

        if (toRevoke.isEmpty()) {
            return false;
        }

        for (var cred : toRevoke) {
            cred.setStatus("REVOKED");
            cred.setRevokedAt(Instant.now());
            credentialRepository.save(cred);
        }

        fenceAfterCommit(stationId, "Credential revoked");

        auditService.recordEvent(
                "CREDENTIAL_REVOKED",
                actorId != null ? actorId : "SYSTEM",
                "USER",
                organizationId,
                "STATION",
                stationId,
                "REVOKE",
                "SUCCESS",
                null,
                AdministrativeAuditService.metadata(Map.of("stationId", stationId))
        );

        return true;
    }

    public List<StationCredentialEntity> findCredentials(String stationId) {
        return credentialRepository.findByStationId(stationId);
    }

    public String hashPassword(String rawPassword) {
        byte[] salt = new byte[SALT_BYTES];
        SECURE_RANDOM.nextBytes(salt);

        byte[] hash = pbkdf2(rawPassword.toCharArray(), salt, ITERATION_COUNT, KEY_LENGTH_BITS);
        return String.format("pbkdf2:%s:%s", HexFormat.of().formatHex(salt), HexFormat.of().formatHex(hash));
    }

    public boolean verifyPasswordHash(String rawPassword, String storedHash) {
        if (storedHash == null || !storedHash.startsWith("pbkdf2:")) {
            return false;
        }

        try {
            String[] parts = storedHash.split(":");
            if (parts.length != 3) {
                return false;
            }

            byte[] salt = HexFormat.of().parseHex(parts[1]);
            byte[] expectedHash = HexFormat.of().parseHex(parts[2]);

            byte[] actualHash = pbkdf2(rawPassword.toCharArray(), salt, ITERATION_COUNT, expectedHash.length * 8);
            return MessageDigest.isEqual(expectedHash, actualHash);
        } catch (Exception e) {
            return false;
        }
    }

    private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int keyLengthBits) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, keyLengthBits);
            SecretKeyFactory factory = SecretKeyFactory.getInstance(HASH_ALGORITHM);
            return factory.generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2 hashing failed", e);
        }
    }
}
