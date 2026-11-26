package com.voltgrid.station.infrastructure.persistence.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationMembershipJpaRepository
        extends JpaRepository<OrganizationMembershipEntity, String> {

    List<OrganizationMembershipEntity> findByOrganizationId(String organizationId);

    long countByOrganizationIdAndRoleAndStatus(String organizationId, String role, String status);

    List<OrganizationMembershipEntity> findByUserId(String userId);

    Optional<OrganizationMembershipEntity> findByOrganizationIdAndUserId(String organizationId, String userId);
}
