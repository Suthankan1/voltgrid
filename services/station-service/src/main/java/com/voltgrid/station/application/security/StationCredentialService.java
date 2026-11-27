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
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class StationCredentialService {

    public static final String HASH_ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final int V1_ITERATION_COUNT = 65_536;
    public static final int V2_ITERATION_COUNT = 210_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_BYTES = 16;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public static final int MAX_CONCURRENT_HASHING = 16;
    private final Semaphore hashingLimiter = new Semaphore(MAX_CONCURRENT_HASHING);

    private static final int MAX_FAILED_ATTEMPTS = 10;
    private static final long FAILURE_WINDOW_MS = 60_000L;
    private static final long THROTTLE_DURATION_MS = 5_000L;
    private final ConcurrentMap<String, AttemptTracker> failureTrackers = new ConcurrentHashMap<>();

    private static class AttemptTracker {
        final AtomicInteger failures = new AtomicInteger(0);
        volatile long windowStart = System.currentTimeMillis();
        volatile long throttledUntil = 0L;
    }

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

    public String generateSecurePassword() {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    public boolean validateCredential(String stationId, String rawPassword) {
        return authenticateCredential(stationId, rawPassword).isPresent();
    }

    public Optional<String> authenticateCredential(String stationId, String rawPassword) {
        if (stationId == null || stationId.isBlank() || rawPassword == null
                || rawPassword.isBlank() || rawPassword.length() > 256) {
            return Optional.empty();
        }

        if (isThrottled(stationId)) {
            return Optional.empty();
        }

        var activeCredentials = credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE").stream()
                .filter(this::isActiveBasicCredential)
                .toList();

        for (var credential : activeCredentials) {
            if (verifyPasswordHash(rawPassword, credential.getPasswordHash())) {
                recordSuccess(stationId);
                if (needsRehash(credential.getPasswordHash())) {
                    credential.setPasswordHash(hashPassword(rawPassword));
                    credentialRepository.save(credential);
                }
                return Optional.of(credential.getId());
            }
        }

        recordFailure(stationId);
        return Optional.empty();
    }

    public boolean isThrottled(String stationId) {
        if (stationId == null) return false;
        var tracker = failureTrackers.get(stationId);
        if (tracker == null) return false;
        long now = System.currentTimeMillis();
        if (tracker.throttledUntil > now) {
            return true;
        }
        if (now - tracker.windowStart > FAILURE_WINDOW_MS) {
            failureTrackers.remove(stationId);
            return false;
        }
        return false;
    }

    private void recordFailure(String stationId) {
        if (stationId == null) return;
        long now = System.currentTimeMillis();
        failureTrackers.compute(stationId, (key, tracker) -> {
            if (tracker == null || now - tracker.windowStart > FAILURE_WINDOW_MS) {
                var newTracker = new AttemptTracker();
                newTracker.failures.set(1);
                newTracker.windowStart = now;
                return newTracker;
            }
            int count = tracker.failures.incrementAndGet();
            if (count >= MAX_FAILED_ATTEMPTS) {
                tracker.throttledUntil = now + THROTTLE_DURATION_MS;
            }
            return tracker;
        });
    }

    private void recordSuccess(String stationId) {
        if (stationId != null) {
            failureTrackers.remove(stationId);
        }
    }

    void resetThrottling(String stationId) {
        if (stationId != null) {
            failureTrackers.remove(stationId);
        }
    }

    Semaphore getHashingLimiter() {
        return hashingLimiter;
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

    public record GeneratedStationCredential(StationCredentialEntity credential, String rawPassword) {}

    @Transactional
    public GeneratedStationCredential provisionGeneratedCredential(String stationId, String actorId, String organizationId) {
        String generatedPassword = generateSecurePassword();
        var credential = provisionCredential(stationId, generatedPassword, actorId, organizationId);
        return new GeneratedStationCredential(credential, generatedPassword);
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
        return hashPassword(rawPassword, V2_ITERATION_COUNT);
    }

    public String hashPassword(String rawPassword, int iterations) {
        byte[] salt = new byte[SALT_BYTES];
        SECURE_RANDOM.nextBytes(salt);

        byte[] hash = executeWithLimiter(() -> pbkdf2(rawPassword.toCharArray(), salt, iterations, KEY_LENGTH_BITS));
        return String.format("pbkdf2-v2:%d:%s:%s", iterations, HexFormat.of().formatHex(salt), HexFormat.of().formatHex(hash));
    }

    public boolean verifyPasswordHash(String rawPassword, String storedHash) {
        if (storedHash == null || rawPassword == null) {
            return false;
        }

        try {
            if (storedHash.startsWith("pbkdf2-v2:")) {
                String[] parts = storedHash.split(":");
                if (parts.length != 4) {
                    return false;
                }
                int iterations = Integer.parseInt(parts[1]);
                byte[] salt = HexFormat.of().parseHex(parts[2]);
                byte[] expectedHash = HexFormat.of().parseHex(parts[3]);

                byte[] actualHash = executeWithLimiter(() ->
                        pbkdf2(rawPassword.toCharArray(), salt, iterations, expectedHash.length * 8));
                return MessageDigest.isEqual(expectedHash, actualHash);
            } else if (storedHash.startsWith("pbkdf2:")) {
                String[] parts = storedHash.split(":");
                if (parts.length != 3) {
                    return false;
                }
                byte[] salt = HexFormat.of().parseHex(parts[1]);
                byte[] expectedHash = HexFormat.of().parseHex(parts[2]);

                byte[] actualHash = executeWithLimiter(() ->
                        pbkdf2(rawPassword.toCharArray(), salt, V1_ITERATION_COUNT, expectedHash.length * 8));
                return MessageDigest.isEqual(expectedHash, actualHash);
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean needsRehash(String storedHash) {
        if (storedHash == null) return true;
        if (!storedHash.startsWith("pbkdf2-v2:")) return true;
        try {
            String[] parts = storedHash.split(":");
            return parts.length < 4 || Integer.parseInt(parts[1]) < V2_ITERATION_COUNT;
        } catch (Exception e) {
            return true;
        }
    }

    @FunctionalInterface
    private interface HashingAction<T> {
        T execute() throws GeneralSecurityException;
    }

    private <T> T executeWithLimiter(HashingAction<T> action) {
        boolean acquired;
        try {
            acquired = hashingLimiter.tryAcquire(2, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Authentication hashing interrupted", e);
        }

        if (!acquired) {
            throw new IllegalStateException("Authentication work capacity exceeded");
        }

        try {
            return action.execute();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2 hashing failed", e);
        } finally {
            hashingLimiter.release();
        }
    }

    private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int keyLengthBits) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, keyLengthBits);
        SecretKeyFactory factory = SecretKeyFactory.getInstance(HASH_ALGORITHM);
        return factory.generateSecret(spec).getEncoded();
    }
}
