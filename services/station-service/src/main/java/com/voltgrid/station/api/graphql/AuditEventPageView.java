package com.voltgrid.station.api.graphql;

import com.voltgrid.station.infrastructure.persistence.jpa.AdministrativeAuditEventEntity;

import java.util.List;

public record AuditEventPageView(
        List<AdministrativeAuditEventEntity> content,
        long totalElements,
        int totalPages,
        int number,
        int size
) {}
