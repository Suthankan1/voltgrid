package com.voltgrid.station.api.security;

import com.voltgrid.station.application.security.AdministrativeAuditService;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.application.security.TenantAuthorizationService;
import com.voltgrid.station.domain.security.Permission;
import com.voltgrid.station.domain.security.RolePermissions;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/operator/organization-access")
public class OrganizationAccessController {

    private final TenantAuthorizationService authorization;
    private final AdministrativeAuditService audit;

    public OrganizationAccessController(TenantAuthorizationService authorization, AdministrativeAuditService audit) {
        this.authorization = authorization;
        this.audit = audit;
    }

    @GetMapping
    public ResponseEntity<Access> check(@RequestParam String organizationId) {
        return authorized(organizationId, false);
    }

    @PostMapping
    public ResponseEntity<Access> switchOrganization(@RequestParam String organizationId) {
        return authorized(organizationId, true);
    }

    private ResponseEntity<Access> authorized(String organizationId, boolean switching) {
        try {
            var role = authorization.authorizedRole(organizationId);
            if (!RolePermissions.hasPermission(role, Permission.STATION_READ)) {
                return ResponseEntity.status(403).build();
            }
            if (switching) {
                audit.recordEvent("ORGANIZATION_CONTEXT_SELECTED", SecurityContext.get().userId(), "USER",
                        organizationId, "ORGANIZATION", organizationId, "SELECT_CONTEXT", "SUCCESS", null, null);
            }
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Access(organizationId, role.name()));
        } catch (TenantAccessDeniedException denied) {
            return ResponseEntity.status(403).build();
        }
    }

    public record Access(String organizationId, String role) {}
}
