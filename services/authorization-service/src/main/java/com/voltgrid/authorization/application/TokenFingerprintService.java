package com.voltgrid.authorization.application;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.*;

@Service
public class TokenFingerprintService {

    private static final String ALGORITHM = "HmacSHA256";
    private static final int MINIMUM_KEY_BYTES = 32;
    public static final String INSECURE_DEFAULT_KEY = "voltgrid-local-development-hmac-key-change-me";

    private final String activeKeyVersion;
    private final Map<String, SecretKeySpec> keysByVersion = new LinkedHashMap<>();

    @Autowired
    public TokenFingerprintService(
            @Value("${voltgrid.authorization.token-hmac-key:${AUTHORIZATION_TOKEN_HMAC_KEY:}}") String activeKey,
            @Value("${voltgrid.authorization.active-key-version:v1}") String activeVersion,
            @Value("${voltgrid.authorization.legacy-keys.v1:}") String legacyKeyV1,
            @Value("${voltgrid.security.require-secure-keys:true}") boolean requireSecureKeys
    ) {
        this.activeKeyVersion = (activeVersion != null && !activeVersion.isBlank()) ? activeVersion.trim() : "v1";

        if (activeKey == null || activeKey.isBlank()
                || (requireSecureKeys && INSECURE_DEFAULT_KEY.equals(activeKey.trim()))) {
            throw new IllegalStateException("A configured authorization token HMAC key is required");
        }
        registerKey(this.activeKeyVersion, activeKey);

        if (legacyKeyV1 != null && !legacyKeyV1.isBlank() && !this.activeKeyVersion.equals("v1")) {
            registerKey("v1", legacyKeyV1);
        }
    }

    public TokenFingerprintService(String activeKey) {
        this(activeKey, "v1", null, false);
    }

    public TokenFingerprintService(String activeKey, String activeVersion, Map<String, String> legacyKeys) {
        this.activeKeyVersion = activeVersion != null ? activeVersion : "v1";
        registerKey(this.activeKeyVersion, activeKey);
        if (legacyKeys != null) {
            legacyKeys.forEach(this::registerKey);
        }
    }

    private void registerKey(String version, String keyMaterial) {
        if (keyMaterial == null || keyMaterial.isBlank()) {
            return;
        }
        var keyBytes = keyMaterial.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MINIMUM_KEY_BYTES) {
            throw new IllegalArgumentException(
                    "Authorization token HMAC key for version " + version + " must be at least 32 bytes"
            );
        }
        keysByVersion.put(version, new SecretKeySpec(keyBytes, ALGORITHM));
    }

    public String fingerprint(String rawToken) {
        return fingerprint(rawToken, activeKeyVersion);
    }

    public String fingerprint(String rawToken, String keyVersion) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Authorization token must not be blank");
        }
        var key = keysByVersion.get(keyVersion);
        if (key == null) {
            throw new IllegalArgumentException("Unknown HMAC key version: " + keyVersion);
        }
        try {
            var mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            var bytes = mac.doFinal(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to calculate HMAC fingerprint", e);
        }
    }

    public Map<String, String> candidateFingerprints(String rawToken) {
        Map<String, String> candidates = new LinkedHashMap<>();
        for (String version : keysByVersion.keySet()) {
            candidates.put(version, fingerprint(rawToken, version));
        }
        return candidates;
    }

    public String getActiveKeyVersion() {
        return activeKeyVersion;
    }

    public Set<String> getConfiguredKeyVersions() {
        return Collections.unmodifiableSet(keysByVersion.keySet());
    }

    @Override
    public String toString() {
        return "TokenFingerprintService[activeKeyVersion=" + activeKeyVersion + ", versions=" + keysByVersion.keySet() + "]";
    }
}
