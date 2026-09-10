package com.voltgrid.authorization.infrastructure.persistence;

import com.voltgrid.authorization.PostgresTestConfiguration;
import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@Transactional
class AuthorizationTokenRepositoryIntegrationTests {

    private final AuthorizationTokenRepository repository;

    @Autowired
    AuthorizationTokenRepositoryIntegrationTests(
            AuthorizationTokenRepository repository
    ) {
        this.repository = repository;
    }

    @Test
    void shouldPersistAndFindAuthorizationTokenByFingerprint() {
        var now = Instant.now();

        var token =
                new AuthorizationTokenEntity(
                        UUID.randomUUID(),
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                        AuthorizationTokenStatus.ACTIVE,
                        null,
                        now,
                        now
                );

        repository.saveAndFlush(token);

        var result =
                repository.findByTokenFingerprint(
                        token.getTokenFingerprint()
                );

        assertThat(result)
                .isPresent();

        assertThat(result.get().getStatus())
                .isEqualTo(
                        AuthorizationTokenStatus.ACTIVE
                );

        assertThat(result.get().getTokenFingerprint())
                .isEqualTo(
                        token.getTokenFingerprint()
                );
    }
}