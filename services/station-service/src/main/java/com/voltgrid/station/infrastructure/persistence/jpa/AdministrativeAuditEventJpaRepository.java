package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdministrativeAuditEventJpaRepository
        extends JpaRepository<AdministrativeAuditEventEntity, String> {

    Page<AdministrativeAuditEventEntity> findByOrganizationIdOrderByCreatedAtDesc(String organizationId, Pageable pageable);

    List<AdministrativeAuditEventEntity> findByResourceIdOrderByCreatedAtDesc(String resourceId);
}
