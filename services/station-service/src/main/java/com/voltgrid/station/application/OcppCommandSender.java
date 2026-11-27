package com.voltgrid.station.application;

public interface OcppCommandSender {
    boolean sendCall(String stationId, String messageId, String action, String payloadJson);
    boolean isStationConnected(String stationId);
}
