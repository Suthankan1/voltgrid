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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationDecisionServiceTests {

    private static final String TEST_KEY =
            "0123456789abcdef0123456789abcdef";

    @Mock
    private AuthorizationTokenRepository repository;

    private TokenFingerprintService fingerprintService;
    private AuthorizationDecisionService service;

    @BeforeEach
    void setUp() {
        fingerprintService =
                new TokenFingerprintService(
                        TEST_KEY
                );

        service =
                new AuthorizationDecisionService(
                        repository,
                        fingerprintService
                );
    }

    @Test
    void shouldAllowActiveToken() {
        var rawToken = "RFID-123";

        when(
                repository.findByTokenFingerprint(
                        fingerprintService.fingerprint(
                                rawToken
                        )
                )
        ).thenReturn(
                Optional.of(
                        token(
                                rawToken,
                                AuthorizationTokenStatus.ACTIVE,
                                null
                        )
                )
        );

        var result =
                service.authorize(
                        "STATION-001",
                        rawToken
                );

        assertThat(result)
                .isEqualTo(
                        TokenAuthorizationDecision.ALLOWED
                );
    }

    @Test
    void shouldRejectUnknownToken() {
        var rawToken = "UNKNOWN";

        when(
                repository.findByTokenFingerprint(
                        fingerprintService.fingerprint(
                                rawToken
                        )
                )
        ).thenReturn(
                Optional.empty()
        );

        var result =
                service.authorize(
                        "STATION-001",
                        rawToken
                );

        assertThat(result)
                .isEqualTo(
                        TokenAuthorizationDecision.UNKNOWN_TOKEN
                );
    }

    @Test
    void shouldRejectBlockedToken() {
        var rawToken = "BLOCKED-RFID";

        when(
                repository.findByTokenFingerprint(
                        fingerprintService.fingerprint(
                                rawToken
                        )
                )
        ).thenReturn(
                Optional.of(
                        token(
                                rawToken,
                                AuthorizationTokenStatus.BLOCKED,
                                null
                        )
                )
        );

        var result =
                service.authorize(
                        "STATION-001",
                        rawToken
                );

        assertThat(result)
                .isEqualTo(
                        TokenAuthorizationDecision.BLOCKED_TOKEN
                );
    }

    @Test
    void shouldRejectExpiredToken() {
        var rawToken = "EXPIRED-RFID";

        when(
                repository.findByTokenFingerprint(
                        fingerprintService.fingerprint(
                                rawToken
                        )
                )
        ).thenReturn(
                Optional.of(
                        token(
                                rawToken,
                                AuthorizationTokenStatus.ACTIVE,
                                Instant.now()
                                        .minusSeconds(60)
                        )
                )
        );

        var result =
                service.authorize(
                        "STATION-001",
                        rawToken
                );

        assertThat(result)
                .isEqualTo(
                        TokenAuthorizationDecision.EXPIRED_TOKEN
                );
    }

    private AuthorizationTokenEntity token(
            String rawToken,
            AuthorizationTokenStatus status,
            Instant expiresAt
    ) {
        var now = Instant.now();

        return new AuthorizationTokenEntity(
                UUID.randomUUID(),
                fingerprintService.fingerprint(
                        rawToken
                ),
                status,
                expiresAt,
                now,
                now
        );
    }
}