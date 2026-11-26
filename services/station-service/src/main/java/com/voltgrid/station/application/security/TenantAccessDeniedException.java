package com.voltgrid.station.application.security;

public class TenantAccessDeniedException extends RuntimeException {

    public TenantAccessDeniedException(String message) {
        super(message);
    }
}
