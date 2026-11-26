package com.voltgrid.station;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
final class ProductionSecurityConfiguration {

    ProductionSecurityConfiguration(
            @Value("${voltgrid.security.require-auth:true}") boolean requireOperatorAuth,
            @Value("${voltgrid.ocpp.auth-required:true}") boolean requireDeviceAuth,
            @Value("${spring.grpc.client.channel.authorization.ssl.enabled:true}") boolean grpcTls,
            @Value("${voltgrid.security.jwt.issuer:}") String issuer,
            @Value("${voltgrid.security.jwt.jwk-set-uri:}") String jwks,
            @Value("${voltgrid.service-auth.station-service-key:${SERVICE_IDENTITY_STATION_SERVICE_KEY:}}") String stationKey
    ) {
        if (!requireOperatorAuth || !requireDeviceAuth || !grpcTls || stationKey.length() < 32
                || !issuer.startsWith("https://") || !jwks.startsWith("https://")) {
            throw new IllegalStateException("Production security requires authenticated endpoints, explicit credentials and TLS");
        }
    }
}
