package com.voltgrid.station.application.security;

import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventJpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AdministrativeAuditService {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Set<String> METADATA_FIELDS = Set.of("stationId", "userId", "role", "newRole");

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
                organizationId,
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

    public static String metadata(Map<String, String> fields) {
        return JSON.writeValueAsString(fields);
    }

    private String redactSensitiveData(String json) {
        if (json == null || json.isBlank()) return "{}";
        try {
            var tree = JSON.readTree(json);
            if (!tree.isObject()) return "{}";

            Map<String, String> sanitized = new LinkedHashMap<>();
            for (var field : tree.properties()) {
                if (METADATA_FIELDS.contains(field.getKey()) && field.getValue().isString()) {
                    sanitized.put(field.getKey(), field.getValue().asString());
                } else {
                    sanitized.put("redacted", "[REDACTED]");
                }
            }
            return metadata(sanitized);
        } catch (JacksonException invalidMetadata) {
            return "{}";
        }
    }
}
