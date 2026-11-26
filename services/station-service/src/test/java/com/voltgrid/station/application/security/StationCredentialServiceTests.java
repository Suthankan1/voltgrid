package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCredentialJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StationCredentialServiceTests {

    @Mock
    private StationCredentialJpaRepository credentialRepository;

    @Mock
    private AdministrativeAuditService auditService;

    private StationCredentialService credentialService;

    @BeforeEach
    void setUp() {
        credentialService = new StationCredentialService(credentialRepository, auditService);
    }

    @Test
    void shouldProvisionCredentialWithSaltedPbkdf2Hash() {
        String stationId = "STA-PROVISION-01";
        String password = "StrongStationPassword#2026";

        var cred = credentialService.provisionCredential(stationId, password, "admin-1", "org-ceylon");

        assertThat(cred.getStationId()).isEqualTo(stationId);
        assertThat(cred.getStatus()).isEqualTo("ACTIVE");
        assertThat(cred.getPasswordHash()).startsWith("pbkdf2:");
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
    void shouldRotateCredentialAndRetainPreviousAsRotated() {
        String stationId = "STA-ROTATE-01";
        String oldPassword = "OldPassword123!";
        String newPassword = "NewRotatedPassword456!";

        var oldCred = new StationCredentialEntity("cred-old", stationId, "BASIC_AUTH", credentialService.hashPassword(oldPassword), "ACTIVE");
        when(credentialRepository.findByStationIdAndStatus(stationId, "ACTIVE")).thenReturn(List.of(oldCred));

        var newCred = credentialService.rotateCredential(stationId, newPassword, "admin-1", "org-ceylon");

        assertThat(oldCred.getStatus()).isEqualTo("ROTATED");
        assertThat(newCred.getStatus()).isEqualTo("ACTIVE");
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
}
