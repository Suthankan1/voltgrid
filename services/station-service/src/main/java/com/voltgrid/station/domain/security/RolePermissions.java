package com.voltgrid.station.domain.security;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public final class RolePermissions {

    private static final Map<Role, Set<Permission>> PERMISSIONS_BY_ROLE = new EnumMap<>(Role.class);

    static {
        PERMISSIONS_BY_ROLE.put(Role.PLATFORM_ADMIN, EnumSet.allOf(Permission.class));

        PERMISSIONS_BY_ROLE.put(Role.ORG_OWNER, EnumSet.of(
                Permission.ORG_READ, Permission.ORG_MANAGE,
                Permission.MEMBER_READ, Permission.MEMBER_MANAGE,
                Permission.SITE_READ, Permission.SITE_MANAGE,
                Permission.STATION_READ, Permission.STATION_REGISTER, Permission.STATION_MANAGE,
                Permission.CREDENTIAL_PROVISION, Permission.CREDENTIAL_ROTATE, Permission.CREDENTIAL_REVOKE,
                Permission.SESSION_READ, Permission.METER_READ, Permission.INTEGRITY_READ,
                Permission.AUDIT_READ
        ));

        PERMISSIONS_BY_ROLE.put(Role.ORG_ADMIN, EnumSet.of(
                Permission.ORG_READ,
                Permission.MEMBER_READ,
                Permission.SITE_READ, Permission.SITE_MANAGE,
                Permission.STATION_READ, Permission.STATION_REGISTER, Permission.STATION_MANAGE,
                Permission.CREDENTIAL_PROVISION, Permission.CREDENTIAL_ROTATE, Permission.CREDENTIAL_REVOKE,
                Permission.SESSION_READ, Permission.METER_READ, Permission.INTEGRITY_READ,
                Permission.AUDIT_READ
        ));

        PERMISSIONS_BY_ROLE.put(Role.OPERATOR, EnumSet.of(
                Permission.ORG_READ,
                Permission.SITE_READ,
                Permission.STATION_READ,
                Permission.SESSION_READ, Permission.METER_READ, Permission.INTEGRITY_READ
        ));

        PERMISSIONS_BY_ROLE.put(Role.TECHNICIAN, EnumSet.of(
                Permission.ORG_READ,
                Permission.SITE_READ,
                Permission.STATION_READ, Permission.STATION_MANAGE,
                Permission.METER_READ, Permission.INTEGRITY_READ
        ));

        PERMISSIONS_BY_ROLE.put(Role.SUPPORT, EnumSet.of(
                Permission.ORG_READ,
                Permission.SITE_READ,
                Permission.STATION_READ,
                Permission.SESSION_READ
        ));

        PERMISSIONS_BY_ROLE.put(Role.FINANCE, EnumSet.of(
                Permission.ORG_READ,
                Permission.SITE_READ,
                Permission.STATION_READ,
                Permission.SESSION_READ, Permission.METER_READ, Permission.INTEGRITY_READ
        ));
    }

    private RolePermissions() {}

    public static Set<Permission> getPermissions(Role role) {
        if (role == null) {
            return Collections.emptySet();
        }
        return PERMISSIONS_BY_ROLE.getOrDefault(role, Collections.emptySet());
    }

    public static boolean hasPermission(Role role, Permission permission) {
        if (role == null || permission == null) {
            return false;
        }
        return getPermissions(role).contains(permission);
    }
}
