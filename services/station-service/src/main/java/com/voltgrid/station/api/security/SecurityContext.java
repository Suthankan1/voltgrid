package com.voltgrid.station.api.security;

import com.voltgrid.station.domain.security.AuthenticatedUser;

import io.micrometer.context.ThreadLocalAccessor;

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

    public static final class Accessor implements ThreadLocalAccessor<AuthenticatedUser> {
        @Override
        public Object key() {
            return "station.operator";
        }

        @Override
        public AuthenticatedUser getValue() {
            return get();
        }

        @Override
        public void setValue(AuthenticatedUser user) {
            set(user);
        }

        @Override
        public void setValue() {
            clear();
        }
    }
}
