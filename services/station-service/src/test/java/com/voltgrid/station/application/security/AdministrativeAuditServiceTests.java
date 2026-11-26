package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdministrativeAuditServiceTests {

    @Mock
    private AdministrativeAuditEventJpaRepository auditRepository;

    private AdministrativeAuditService auditService;

    @BeforeEach
    void setUp() {
        auditService = new AdministrativeAuditService(auditRepository);
    }

    @Test
    void shouldRecordAuditEventAndRedactSensitiveMetadata() {
        String metadataWithSecret = "{\"stationId\":\"STA-1\",\"password\":\"Secret123!\",\"apiKey\":\"key-abc\"}";

        when(auditRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var event = auditService.recordEvent(
                "STATION_REGISTERED",
                "user-admin",
                "USER",
                "org-ceylon",
                "STATION",
                "STA-1",
                "REGISTER",
                "SUCCESS",
                "corr-123",
                metadataWithSecret
        );

        assertThat(event.getId()).startsWith("audit_");
        assertThat(event.getEventType()).isEqualTo("STATION_REGISTERED");
        assertThat(event.getOrganizationId()).isEqualTo("org-ceylon");
        assertThat(event.getMetadata()).doesNotContain("Secret123!");
        assertThat(event.getMetadata()).doesNotContain("key-abc");
        assertThat(event.getMetadata()).contains("[REDACTED]");
    }

    @Test
    void shouldFindEventsPagedByOrganization() {
        var event = new AdministrativeAuditEventEntity(
                "audit-1", "org-ceylon", "STATION_REGISTERED", "user-1", "USER",
                "STATION", "STA-1", "REGISTER", "SUCCESS", null, "{}"
        );

        when(auditRepository.findByOrganizationIdOrderByCreatedAtDesc(eq("org-ceylon"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(event)));

        var paged = auditService.findEvents("org-ceylon", 0, 10);

        assertThat(paged.getContent()).hasSize(1);
        assertThat(paged.getContent().get(0).getId()).isEqualTo("audit-1");
    }
}
