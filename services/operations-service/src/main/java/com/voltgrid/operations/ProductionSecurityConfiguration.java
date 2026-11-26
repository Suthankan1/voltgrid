package com.voltgrid.operations;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
final class ProductionSecurityConfiguration {

    ProductionSecurityConfiguration(
            @Value("${voltgrid.security.require-auth:true}") boolean requireOperatorAuth,
            @Value("${voltgrid.security.jwt.issuer:}") String issuer,
            @Value("${voltgrid.security.jwt.jwk-set-uri:}") String jwks,
            @Value("${voltgrid.station-access-base-url:}") String stationAccess
    ) {
        if (!requireOperatorAuth || !issuer.startsWith("https://") || !jwks.startsWith("https://")
                || !stationAccess.startsWith("https://")) {
            throw new IllegalStateException("Production security requires authenticated endpoints, explicit credentials and TLS");
        }
    }
}
