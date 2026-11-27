package com.voltgrid.station.domain;

public enum CommandStatus {
    REQUESTED,
    PENDING,
    ACCEPTED,
    REJECTED,
    TIMED_OUT,
    UNCERTAIN,
    OBSERVED
}
