package com.voltgrid.station.api.graphql;

public record StationCredentialPayload(
        String credentialId,
        String stationId,
        String credentialType,
        String status,
        String createdAt
) {}
