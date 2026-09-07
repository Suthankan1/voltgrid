package com.voltgrid.station.application;

public class StationAlreadyExistsException extends RuntimeException {

    public StationAlreadyExistsException(String stationId) {
        super("Station already exists: " + stationId);
    }
}