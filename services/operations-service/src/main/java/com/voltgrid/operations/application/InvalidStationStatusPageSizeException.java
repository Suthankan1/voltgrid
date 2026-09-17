package com.voltgrid.operations.application;

public class InvalidStationStatusPageSizeException
        extends RuntimeException {

    public InvalidStationStatusPageSizeException(
            int minimum,
            int maximum
    ) {
        super(
                "Station status page size must be between "
                        + minimum
                        + " and "
                        + maximum
        );
    }
}