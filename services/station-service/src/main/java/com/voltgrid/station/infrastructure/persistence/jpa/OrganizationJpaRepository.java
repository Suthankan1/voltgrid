package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface OrganizationJpaRepository
        extends JpaRepository<OrganizationEntity, String> {

    @Modifying
    @Query(value = """
            INSERT INTO organizations (id, name, status)
            VALUES (:id, :name, 'ACTIVE')
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int insertOrganization(String id, String name);

    Optional<OrganizationEntity> findByName(String name);
}
