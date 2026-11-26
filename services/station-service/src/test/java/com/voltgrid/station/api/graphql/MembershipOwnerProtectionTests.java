package com.voltgrid.station.api.graphql;

import com.voltgrid.station.api.security.SecurityContext;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.domain.security.AuthenticatedUser;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class MembershipOwnerProtectionTests {

    @Autowired
    private StationGraphQlController controller;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private final String organization = "owner-test-" + UUID.randomUUID();

    @BeforeEach
    void createOrganization() {
        jdbc.update("INSERT INTO organizations (id, name) VALUES (?, 'Owner protection test')", organization);
        addOwner("first-owner");
        SecurityContext.set(new AuthenticatedUser("first-owner", "", Set.of(), organization));
    }

    @AfterEach
    void clearIdentity() {
        SecurityContext.clear();
    }

    @Test
    void deniesRevokingOrDowngradingFinalOwnerWithoutSuccessAudit() {
        assertThatThrownBy(() -> controller.revokeMember(organization, "first-owner"))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("retain an active owner");
        assertThatThrownBy(() -> controller.updateMemberRole(organization, "first-owner", "OPERATOR"))
                .isInstanceOf(TenantAccessDeniedException.class)
                .hasMessageContaining("retain an active owner");

        assertThat(activeOwners()).containsExactly("first-owner");
        assertThat(auditEventTypes()).isEmpty();
    }

    @Test
    void permitsHandoffAndDeniesSubsequentAdministrationByRevokedOwner() {
        addOwner("second-owner");
        assertThat(controller.revokeMember(organization, "first-owner")).isTrue();
        assertThatThrownBy(() -> controller.updateMemberRole(organization, "first-owner", "ORG_OWNER"))
                .isInstanceOf(TenantAccessDeniedException.class);

        assertThat(activeOwners()).containsExactly("second-owner");
        assertThat(auditEventTypes()).containsExactly("MEMBERSHIP_REVOKED");
    }

    @Test
    void serializesConcurrentOwnerRemovalsUntilTheFirstCommits() throws Exception {
        addOwner("second-owner");
        var transactions = new TransactionTemplate(transactionManager);
        var secondConnection = new CompletableFuture<Integer>();

        try (var executor = Executors.newSingleThreadExecutor()) {
            var first = transactionManager.getTransaction(transactions);
            try {
                assertThat(controller.revokeMember(organization, "first-owner")).isTrue();
                var second = executor.submit(() -> transactions.execute(status -> {
                    secondConnection.complete(jdbc.queryForObject("SELECT pg_backend_pid()", Integer.class));
                    SecurityContext.set(new AuthenticatedUser("second-owner", "", Set.of(), organization));
                    try {
                        return controller.revokeMember(organization, "second-owner");
                    } finally {
                        SecurityContext.clear();
                    }
                }));

                awaitDatabaseLock(secondConnection.get(5, TimeUnit.SECONDS));
                transactionManager.commit(first);
                assertThatThrownBy(() -> second.get(5, TimeUnit.SECONDS))
                        .isInstanceOf(ExecutionException.class)
                        .hasCauseInstanceOf(TenantAccessDeniedException.class)
                        .hasRootCauseMessage("An organization must retain an active owner");
            } finally {
                if (!first.isCompleted()) {
                    transactionManager.rollback(first);
                }
            }
        }

        assertThat(activeOwners()).containsExactly("second-owner");
        assertThat(auditEventTypes()).containsExactly("MEMBERSHIP_REVOKED");
    }

    private void awaitDatabaseLock(int backendPid) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        do {
            if (Boolean.TRUE.equals(jdbc.queryForObject("""
                    SELECT cardinality(pg_blocking_pids(?)) > 0
                    """, Boolean.class, backendPid))) {
                return;
            }
            Thread.sleep(20);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("The second membership update did not wait for the first transaction");
    }

    private void addOwner(String user) {
        jdbc.update("""
                INSERT INTO organization_memberships (id, organization_id, user_id, user_email, role)
                VALUES (?, ?, ?, ?, 'ORG_OWNER')
                """, UUID.randomUUID().toString(), organization, user, user + "@example.test");
    }

    private List<String> activeOwners() {
        return jdbc.queryForList("""
                SELECT user_id FROM organization_memberships
                WHERE organization_id = ? AND role = 'ORG_OWNER' AND status = 'ACTIVE'
                """, String.class, organization);
    }

    private List<String> auditEventTypes() {
        return jdbc.queryForList("""
                SELECT event_type FROM administrative_audit_events WHERE organization_id = ?
                """, String.class, organization);
    }
}
