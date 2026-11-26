package com.voltgrid.station.api.security;

import com.voltgrid.station.domain.security.AuthenticatedUser;

public final class SecurityContext {

    private static final ThreadLocal<AuthenticatedUser> CURRENT_USER = new ThreadLocal<>();

    private SecurityContext() {}

    public static void set(AuthenticatedUser user) {
        CURRENT_USER.set(user);
    }

    public static AuthenticatedUser get() {
        return CURRENT_USER.get();
    }

    public static void clear() {
        CURRENT_USER.remove();
    }
}
