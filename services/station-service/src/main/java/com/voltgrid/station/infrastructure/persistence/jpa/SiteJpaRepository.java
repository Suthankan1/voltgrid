package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SiteJpaRepository
        extends JpaRepository<SiteEntity, String> {

    @Modifying
    @Query(value = """
            INSERT INTO sites (id, organization_id, name, status)
            VALUES (:id, :organizationId, :name, 'ACTIVE')
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int insertSite(String id, String organizationId, String name);

    List<SiteEntity> findByOrganizationId(String organizationId);
}
