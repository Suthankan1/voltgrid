package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StationCredentialServiceTests {

    @Mock
    private StationCredentialJpaRepository credentialRepository;

    @Mock
    private AdministrativeAuditService auditService;

    @Mock
    private OcppSessionFencer sessionFencer;

    private StationCredentialService credentialService;

    @BeforeEach
    void setUp() {
        credentialService = new StationCredentialService(credentialRepository, auditService, sessionFencer);
    }

    @Test
    void shouldProvisionCredentialWithSaltedPbkdf2V2Hash() {
        String stationId = "STA-PROVISION-01";
        String password = "StrongStationPassword#2026";

        var cred = credentialService.provisionCredential(stationId, password, "admin-1", "org-ceylon");

        assertThat(cred.getStationId()).isEqualTo(stationId);
        assertThat(cred.getStatus()).isEqualTo("ACTIVE");
        assertThat(cred.getPasswordHash()).startsWith("pbkdf2-v2:210000:");
        assertThat(cred.getPasswordHash()).doesNotContain(password);

        verify(credentialRepository, times(1)).save(cred);
        verify(auditService, times(1)).recordEvent(
                eq("CREDENTIAL_PROVISIONED"),
                eq("admin-1"),
                eq("USER"),
                eq("org-ceylon"),
                eq("CREDENTIAL"),
                any(),
                eq("PROVISION"),
                eq("SUCCESS"),
                isNull(),
                contains(stationId)
        );
    }

    @Test
    void shouldValidateCorrectPasswordAgainstSaltedHash() {
        String stationId = "STA-VAL-01";
        String password = "SecretChargerPass123!";
        String hash = credentialService.hashPassword(password);

        var cred = new StationCredentialEntity("cred-1", stationId, "BASIC_AUTH", hash, "ACTIVE");
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of(cred));

        assertThat(credentialService.validateCredential(stationId, password)).isTrue();
        assertThat(credentialService.validateCredential(stationId, "WrongPassword!")).isFalse();
    }

    @Test
    void shouldValidateAndTransparentlyUpgradeLegacyHash() {
        String stationId = "STA-UPGRADE-01";
        String password = "LegacyPassword123!";

        // Legacy format: pbkdf2:salt:hash (65,536 iterations)
        String legacyHash = "pbkdf2:" + HexFormat.of().formatHex(new byte[16]) + ":"
                + HexFormat.of().formatHex(new byte[32]);
        // Compute real legacy hash with legacy iterations
        String realLegacyHash = credentialService.hashPassword(password, StationCredentialService.V1_ITERATION_COUNT)
                .replaceFirst("^pbkdf2-v2:\\d+:", "pbkdf2:");

        var legacyCred = new StationCredentialEntity("cred-legacy", stationId, "BASIC_AUTH", realLegacyHash, "ACTIVE");
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of(legacyCred));

        assertThat(credentialService.needsRehash(realLegacyHash)).isTrue();

        Optional<String> authResult = credentialService.authenticateCredential(stationId, password);
        assertThat(authResult).contains("cred-legacy");
        assertThat(legacyCred.getPasswordHash()).startsWith("pbkdf2-v2:210000:");
        assertThat(credentialService.needsRehash(legacyCred.getPasswordHash())).isFalse();
        verify(credentialRepository, times(1)).save(legacyCred);
    }

    @Test
    void shouldRotateCredentialAndRetainPreviousAsRotated() {
        String stationId = "STA-ROTATE-01";
        String oldPassword = "OldPassword123!";
        String newPassword = "NewRotatedPassword456!";

        var oldCred = new StationCredentialEntity("cred-old", stationId, "BASIC_AUTH", credentialService.hashPassword(oldPassword), "ACTIVE");
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of(oldCred));

        var newCred = credentialService.rotateCredential(stationId, newPassword, "admin-1", "org-ceylon");

        assertThat(oldCred.getStatus()).isEqualTo("ROTATED");
        assertThat(newCred.getStatus()).isEqualTo("ACTIVE");
        assertThat(newCred.getPasswordHash()).startsWith("pbkdf2-v2:210000:");
        verify(credentialRepository, times(1)).save(oldCred);
        verify(credentialRepository, times(1)).save(newCred);
    }

    @Test
    void shouldRevokeAllCredentialsForStation() {
        String stationId = "STA-REVOKE-01";
        var cred1 = new StationCredentialEntity("c1", stationId, "BASIC_AUTH", "hash1", "ACTIVE");
        var cred2 = new StationCredentialEntity("c2", stationId, "BASIC_AUTH", "hash2", "ROTATED");

        when(credentialRepository.findByStationId(stationId)).thenReturn(List.of(cred1, cred2));

        boolean revoked = credentialService.revokeCredential(stationId, "admin-1", "org-ceylon");

        assertThat(revoked).isTrue();
        assertThat(cred1.getStatus()).isEqualTo("REVOKED");
        assertThat(cred2.getStatus()).isEqualTo("REVOKED");
        verify(auditService, times(1)).recordEvent(
                eq("CREDENTIAL_REVOKED"),
                eq("admin-1"),
                eq("USER"),
                eq("org-ceylon"),
                eq("STATION"),
                eq(stationId),
                eq("REVOKE"),
                eq("SUCCESS"),
                isNull(),
                contains(stationId)
        );
    }

    @Test
    void shouldRejectShortPassword() {
        assertThatThrownBy(() -> credentialService.provisionCredential("STA-1", "short", "admin", "org"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 8 and 256 characters");
    }

    @Test
    void shouldGenerateHighEntropySecurePassword() {
        String generated = credentialService.generateSecurePassword();
        assertThat(generated).isNotBlank();
        assertThat(generated.length()).isGreaterThanOrEqualTo(40);

        String generatedSecond = credentialService.generateSecurePassword();
        assertThat(generated).isNotEqualTo(generatedSecond);
    }

    @Test
    void shouldProvisionGeneratedCredentialWithSecurePassword() {
        String stationId = "STA-GEN-01";
        var result = credentialService.provisionGeneratedCredential(stationId, "admin-1", "org-ceylon");

        assertThat(result.rawPassword()).isNotBlank();
        assertThat(result.credential().getStationId()).isEqualTo(stationId);
        assertThat(result.credential().getPasswordHash()).startsWith("pbkdf2-v2:210000:");
        verify(credentialRepository, times(1)).save(result.credential());
    }

    @Test
    void shouldThrottleRepeatedFailedAuthenticationsRecoverably() {
        String stationId = "STA-THROTTLE-01";
        var cred = new StationCredentialEntity("cred-1", stationId, "BASIC_AUTH", credentialService.hashPassword("CorrectPass123!"), "ACTIVE");
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of(cred));

        // 9 failed attempts should not throttle
        for (int i = 0; i < 9; i++) {
            assertThat(credentialService.authenticateCredential(stationId, "WrongPass" + i)).isEmpty();
            assertThat(credentialService.isThrottled(stationId)).isFalse();
        }

        // 10th failure triggers throttling
        assertThat(credentialService.authenticateCredential(stationId, "WrongPass9")).isEmpty();
        assertThat(credentialService.isThrottled(stationId)).isTrue();

        // While throttled, even the correct password is denied early without hashing
        assertThat(credentialService.authenticateCredential(stationId, "CorrectPass123!")).isEmpty();

        // Resetting throttling restores immediate valid authentication
        credentialService.resetThrottling(stationId);
        assertThat(credentialService.isThrottled(stationId)).isFalse();
        assertThat(credentialService.authenticateCredential(stationId, "CorrectPass123!")).contains("cred-1");
    }

    @Test
    void shouldBoundConcurrencyDuringExpensiveHashing() {
        var limiter = credentialService.getHashingLimiter();
        limiter.drainPermits();

        try {
            assertThatThrownBy(() -> credentialService.hashPassword("AnyPassword123!"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("capacity exceeded");
        } finally {
            limiter.release(StationCredentialService.MAX_CONCURRENT_HASHING);
        }
    }

    @Test
    void shouldExecuteFencingOnlyAfterTransactionCommit() {
        String stationId = "STA-COMMIT-01";
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        try {
            credentialService.rotateCredential(stationId, "NewPassword123!", "admin-1", "org-ceylon");
            verify(sessionFencer, never()).terminateSession(any(), any());

            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }

            verify(sessionFencer, times(1)).terminateSession(eq(stationId), contains("rotated"));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void shouldNotExecuteFencingWhenTransactionRollsBack() {
        String stationId = "STA-ROLLBACK-01";
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        try {
            credentialService.rotateCredential(stationId, "NewPassword123!", "admin-1", "org-ceylon");
            verify(sessionFencer, never()).terminateSession(any(), any());
            // Rollback occurs: clear synchronization without calling afterCommit
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(sessionFencer, never()).terminateSession(any(), any());
    }
}
