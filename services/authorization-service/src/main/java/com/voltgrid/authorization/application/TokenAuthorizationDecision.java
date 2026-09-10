package com.voltgrid.authorization.application;

public enum TokenAuthorizationDecision {
    ALLOWED,
    UNKNOWN_TOKEN,
    BLOCKED_TOKEN,
    EXPIRED_TOKEN
}