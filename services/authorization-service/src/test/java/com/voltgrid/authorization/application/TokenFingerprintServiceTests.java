package com.voltgrid.authorization.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenFingerprintServiceTests {

    private static final String TEST_KEY =
            "0123456789abcdef0123456789abcdef";

    private final TokenFingerprintService service =
            new TokenFingerprintService(
                    TEST_KEY
            );

    @Test
    void shouldGenerateHmacSha256Fingerprint() {
        var fingerprint =
                service.fingerprint(
                        "RFID-123"
                );

        assertThat(fingerprint)
                .isEqualTo(
                        "93cf035dc901f464e18a8d0ac23b89f2490e2d9f49a8cefeb88d1e6d16428217"
                );
    }

    @Test
    void shouldGenerateSameFingerprintForSameToken() {
        var first =
                service.fingerprint(
                        "RFID-123"
                );

        var second =
                service.fingerprint(
                        "RFID-123"
                );

        assertThat(second)
                .isEqualTo(first);
    }

    @Test
    void shouldGenerateDifferentFingerprintForDifferentTokens() {
        var first =
                service.fingerprint(
                        "RFID-123"
                );

        var second =
                service.fingerprint(
                        "RFID-456"
                );

        assertThat(second)
                .isNotEqualTo(first);
    }

    @Test
    void shouldRejectBlankToken() {
        assertThatThrownBy(
                () -> service.fingerprint("")
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessage(
                        "Authorization token must not be blank"
                );
    }

    @Test
    void shouldRejectShortHmacKey() {
        assertThatThrownBy(
                () ->
                        new TokenFingerprintService(
                                "too-short"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "at least 32 bytes"
                );
    }
}