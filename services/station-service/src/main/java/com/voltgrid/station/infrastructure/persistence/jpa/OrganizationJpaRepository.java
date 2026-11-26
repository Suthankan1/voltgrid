package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganizationJpaRepository
        extends JpaRepository<OrganizationEntity, String> {

    Optional<OrganizationEntity> findByName(String name);
}
