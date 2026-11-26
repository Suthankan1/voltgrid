package com.voltgrid.station.domain.security;

public enum Permission {
    ORG_READ("org:read"),
    ORG_MANAGE("org:manage"),
    MEMBER_READ("member:read"),
    MEMBER_MANAGE("member:manage"),
    SITE_READ("site:read"),
    SITE_MANAGE("site:manage"),
    STATION_READ("station:read"),
    STATION_REGISTER("station:register"),
    STATION_MANAGE("station:manage"),
    CREDENTIAL_PROVISION("credential:provision"),
    CREDENTIAL_ROTATE("credential:rotate"),
    CREDENTIAL_REVOKE("credential:revoke"),
    SESSION_READ("session:read"),
    METER_READ("meter:read"),
    INTEGRITY_READ("integrity:read"),
    AUDIT_READ("audit:read");

    private final String value;

    Permission(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
