package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SiteJpaRepository
        extends JpaRepository<SiteEntity, String> {

    List<SiteEntity> findByOrganizationId(String organizationId);
}
