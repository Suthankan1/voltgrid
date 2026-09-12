package com.voltgrid.authorization.application;

public class AuthorizationBackendUnavailableException
        extends RuntimeException {

    public AuthorizationBackendUnavailableException(
            String message,
            Throwable cause
    ) {
        super(message, cause);
    }
}