package com.voltgrid.station.application;

public interface AuthorizationClient {

    AuthorizationResult authorize(
            String stationId,
            String idToken
    );
}