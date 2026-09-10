package com.voltgrid.station.application;

public record AuthorizationResult(
        AuthorizationOutcome outcome,
        AuthorizationReasonCode reason
) {
}