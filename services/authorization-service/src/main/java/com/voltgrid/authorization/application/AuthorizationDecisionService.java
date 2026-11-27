package com.voltgrid.authorization.application;

import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenEntity;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class AuthorizationDecisionService {

    private final AuthorizationTokenRepository tokenRepository;
    private final TokenFingerprintService fingerprintService;
    private final MeterRegistry meterRegistry;

    @Autowired
    public AuthorizationDecisionService(
            AuthorizationTokenRepository tokenRepository,
            TokenFingerprintService fingerprintService,
            @Autowired(required = false) MeterRegistry meterRegistry
    ) {
        this.tokenRepository = tokenRepository;
        this.fingerprintService = fingerprintService;
        this.meterRegistry = meterRegistry;
    }

    public AuthorizationDecisionService(
            AuthorizationTokenRepository tokenRepository,
            TokenFingerprintService fingerprintService
    ) {
        this(tokenRepository, fingerprintService, null);
    }

    @Transactional
    public TokenAuthorizationDecision authorize(
            String stationId,
            String rawToken
    ) {
        Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
        try {
            var decision = doAuthorize(stationId, rawToken);
            if (meterRegistry != null) {
                meterRegistry.counter(
                        "voltgrid.authorization.decisions",
                        "status", decision.name()
                ).increment();
            }
            return decision;
        } finally {
            if (sample != null) {
                sample.stop(meterRegistry.timer("voltgrid.authorization.duration"));
            }
        }
    }

    private TokenAuthorizationDecision doAuthorize(
            String stationId,
            String rawToken
    ) {
        if (rawToken == null || rawToken.isBlank()) {
            return TokenAuthorizationDecision.UNKNOWN_TOKEN;
        }

        try {
            var activeFingerprint = fingerprintService.fingerprint(rawToken);
            var activeMatch = tokenRepository.findByTokenFingerprint(activeFingerprint);
            if (activeMatch.isPresent()) {
                return evaluate(activeMatch.get());
            }

            // Transparent legacy key migration: check configured legacy keys
            var candidates = fingerprintService.candidateFingerprints(rawToken);
            for (var entry : candidates.entrySet()) {
                var version = entry.getKey();
                if (!version.equals(fingerprintService.getActiveKeyVersion())) {
                    var legacyFingerprint = entry.getValue();
                    var legacyMatch = tokenRepository.findByTokenFingerprint(legacyFingerprint);
                    if (legacyMatch.isPresent()) {
                        var token = legacyMatch.get();
                        token.setTokenFingerprint(activeFingerprint);
                        token.setKeyVersion(fingerprintService.getActiveKeyVersion());
                        token.setUpdatedAt(Instant.now());
                        tokenRepository.save(token);
                        return evaluate(token);
                    }
                }
            }

            return TokenAuthorizationDecision.UNKNOWN_TOKEN;

        } catch (DataAccessException exception) {
            throw new AuthorizationBackendUnavailableException(
                    "Authorization backend unavailable",
                    exception
            );
        }
    }

    private TokenAuthorizationDecision evaluate(
            AuthorizationTokenEntity token
    ) {
        if (token.getStatus() == AuthorizationTokenStatus.BLOCKED) {
            return TokenAuthorizationDecision.BLOCKED_TOKEN;
        }

        if (token.getExpiresAt() != null
                && token.getExpiresAt().isBefore(Instant.now())) {

            return TokenAuthorizationDecision.EXPIRED_TOKEN;
        }

        return TokenAuthorizationDecision.ALLOWED;
    }
}
