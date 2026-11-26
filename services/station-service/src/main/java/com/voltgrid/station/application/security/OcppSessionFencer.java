package com.voltgrid.station.application.security;

public interface OcppSessionFencer {
    void terminateSession(String stationId, String reason);
}
