package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventJpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AdministrativeAuditService {

    private static final Pattern SENSITIVE_PATTERN =
            Pattern.compile("(?i)(\"?(?:password|token|secret|key|credential|authorization)\"?\\s*:\\s*\")[^\"]*(\")");

    private final AdministrativeAuditEventJpaRepository auditRepository;

    public AdministrativeAuditService(AdministrativeAuditEventJpaRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    @Transactional
    public AdministrativeAuditEventEntity recordEvent(
            String eventType,
            String actorId,
            String actorType,
            String organizationId,
            String resourceType,
            String resourceId,
            String action,
            String outcome,
            String correlationId,
            String metadata
    ) {
        String eventId = "audit_" + UUID.randomUUID().toString().replace("-", "");
        String sanitizedMetadata = redactSensitiveData(metadata);

        var event = new AdministrativeAuditEventEntity(
                eventId,
                organizationId != null ? organizationId : "org_voltgrid_default",
                eventType,
                actorId != null ? actorId : "SYSTEM",
                actorType != null ? actorType : "USER",
                resourceType,
                resourceId,
                action,
                outcome != null ? outcome : "SUCCESS",
                correlationId,
                sanitizedMetadata
        );

        return auditRepository.save(event);
    }

    public Page<AdministrativeAuditEventEntity> findEvents(String organizationId, int page, int size) {
        int boundedSize = Math.min(Math.max(1, size), 100);
        int boundedPage = Math.max(0, page);
        return auditRepository.findByOrganizationIdOrderByCreatedAtDesc(
                organizationId,
                PageRequest.of(boundedPage, boundedSize)
        );
    }

    public String redactSensitiveData(String json) {
        if (json == null || json.isBlank()) {
            return "{}";
        }
        return SENSITIVE_PATTERN.matcher(json).replaceAll("$1[REDACTED]$2");
    }
}
