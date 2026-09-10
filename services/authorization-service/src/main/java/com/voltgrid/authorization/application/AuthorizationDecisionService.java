package com.voltgrid.authorization.application;

import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenEntity;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthorizationDecisionService {

    private final AuthorizationTokenRepository tokenRepository;
    private final TokenFingerprintService fingerprintService;

    public AuthorizationDecisionService(
            AuthorizationTokenRepository tokenRepository,
            TokenFingerprintService fingerprintService
    ) {
        this.tokenRepository = tokenRepository;
        this.fingerprintService = fingerprintService;
    }

    public TokenAuthorizationDecision authorize(
            String stationId,
            String rawToken
    ) {
        var fingerprint =
                fingerprintService.fingerprint(
                        rawToken
                );

        return tokenRepository
                .findByTokenFingerprint(
                        fingerprint
                )
                .map(this::evaluate)
                .orElse(
                        TokenAuthorizationDecision.UNKNOWN_TOKEN
                );
    }

    private TokenAuthorizationDecision evaluate(
            AuthorizationTokenEntity token
    ) {
        if (token.getStatus()
                == AuthorizationTokenStatus.BLOCKED) {

            return TokenAuthorizationDecision.BLOCKED_TOKEN;
        }

        var expiresAt =
                token.getExpiresAt();

        if (expiresAt != null
                && !expiresAt.isAfter(
                        Instant.now()
                )) {

            return TokenAuthorizationDecision.EXPIRED_TOKEN;
        }

        return TokenAuthorizationDecision.ALLOWED;
    }
}