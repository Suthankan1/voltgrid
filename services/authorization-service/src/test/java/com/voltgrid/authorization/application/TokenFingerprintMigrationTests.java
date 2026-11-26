package com.voltgrid.authorization.application;

import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenEntity;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenFingerprintMigrationTests {

    private static final String KEY_V1 = "legacy-development-key-32-bytes-long!";
    private static final String KEY_V2 = "production-active-key-32-bytes-long!!";

    @Mock
    private AuthorizationTokenRepository repository;

    private TokenFingerprintService fingerprintService;
    private AuthorizationDecisionService decisionService;

    @BeforeEach
    void setUp() {
        fingerprintService = new TokenFingerprintService(
                KEY_V2,
                "v2",
                Map.of("v1", KEY_V1)
        );
        decisionService = new AuthorizationDecisionService(repository, fingerprintService);
    }

    @Test
    void shouldAuthorizeDirectlyWithActiveKeyVersion() {
        var rawToken = "RFID-ACTIVE-TOKEN";
        var v2Fingerprint = fingerprintService.fingerprint(rawToken, "v2");

        var tokenEntity = new AuthorizationTokenEntity(
                UUID.randomUUID(),
                v2Fingerprint,
                AuthorizationTokenStatus.ACTIVE,
                null,
                "v2",
                Instant.now(),
                Instant.now()
        );

        when(repository.findByTokenFingerprint(v2Fingerprint)).thenReturn(Optional.of(tokenEntity));

        var decision = decisionService.authorize("STA-001", rawToken);

        assertThat(decision).isEqualTo(TokenAuthorizationDecision.ALLOWED);
        verify(repository, never()).save(any());
    }

    @Test
    void shouldTransparentlyMigrateTokenFromLegacyKeyToActiveKey() {
        var rawToken = "RFID-LEGACY-TOKEN";
        var v1Fingerprint = fingerprintService.fingerprint(rawToken, "v1");
        var v2Fingerprint = fingerprintService.fingerprint(rawToken, "v2");

        var legacyTokenEntity = new AuthorizationTokenEntity(
                UUID.randomUUID(),
                v1Fingerprint,
                AuthorizationTokenStatus.ACTIVE,
                null,
                "v1",
                Instant.now(),
                Instant.now()
        );

        when(repository.findByTokenFingerprint(v2Fingerprint)).thenReturn(Optional.empty());
        when(repository.findByTokenFingerprint(v1Fingerprint)).thenReturn(Optional.of(legacyTokenEntity));

        var decision = decisionService.authorize("STA-001", rawToken);

        assertThat(decision).isEqualTo(TokenAuthorizationDecision.ALLOWED);
        assertThat(legacyTokenEntity.getKeyVersion()).isEqualTo("v2");
        assertThat(legacyTokenEntity.getTokenFingerprint()).isEqualTo(v2Fingerprint);
        verify(repository, times(1)).save(legacyTokenEntity);
    }

    @Test
    void shouldFailStartupWhenRequireSecureKeysAndInsecureDefaultKeyProvided() {
        assertThatThrownBy(() -> new TokenFingerprintService(
                TokenFingerprintService.INSECURE_DEFAULT_KEY,
                "v1",
                null,
                true
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Production profile requires a non-default");
    }

    @Test
    void shouldFailStartupWhenKeyIsShorterThan32Bytes() {
        assertThatThrownBy(() -> new TokenFingerprintService("too-short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 32 bytes");
    }

    @Test
    void shouldRedactSecretFromToString() {
        var str = fingerprintService.toString();
        assertThat(str).doesNotContain(KEY_V1).doesNotContain(KEY_V2);
        assertThat(str).contains("activeKeyVersion=v2");
    }
}
