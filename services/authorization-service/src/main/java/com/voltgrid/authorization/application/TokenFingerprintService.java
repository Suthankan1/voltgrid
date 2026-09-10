package com.voltgrid.authorization.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

@Service
public class TokenFingerprintService {

    private static final String ALGORITHM =
            "HmacSHA256";

    private static final int MINIMUM_KEY_BYTES =
            32;

    private final SecretKeySpec secretKey;

    public TokenFingerprintService(
            @Value(
                    "${voltgrid.authorization.token-hmac-key}"
            )
            String hmacKey
    ) {
        var keyBytes =
                hmacKey.getBytes(
                        StandardCharsets.UTF_8
                );

        if (keyBytes.length < MINIMUM_KEY_BYTES) {
            throw new IllegalArgumentException(
                    "Authorization token HMAC key must be at least 32 bytes"
            );
        }

        this.secretKey =
                new SecretKeySpec(
                        keyBytes,
                        ALGORITHM
                );
    }

    public String fingerprint(
            String rawToken
    ) {
        if (rawToken == null
                || rawToken.isBlank()) {

            throw new IllegalArgumentException(
                    "Authorization token must not be blank"
            );
        }

        try {
            var mac =
                    Mac.getInstance(
                            ALGORITHM
                    );

            mac.init(secretKey);

            var fingerprint =
                    mac.doFinal(
                            rawToken.getBytes(
                                    StandardCharsets.UTF_8
                            )
                    );

            return HexFormat.of()
                    .formatHex(
                            fingerprint
                    );

        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(
                    "Could not fingerprint authorization token",
                    exception
            );
        }
    }
}