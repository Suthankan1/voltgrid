package com.voltgrid.station.application;

public class ConflictingCommandException extends IllegalArgumentException {
    public ConflictingCommandException(String message) {
        super(message);
    }
}
