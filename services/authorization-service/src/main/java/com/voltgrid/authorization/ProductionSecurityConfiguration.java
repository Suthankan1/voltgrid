package com.voltgrid.authorization;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
final class ProductionSecurityConfiguration {

    ProductionSecurityConfiguration(
            @Value("${voltgrid.service-auth.enabled:true}") boolean requireServiceAuth,
            @Value("${voltgrid.security.require-secure-keys:true}") boolean requireSecureKeys,
            @Value("${spring.grpc.server.ssl.enabled:false}") boolean grpcTls,
            @Value("${spring.grpc.server.ssl.bundle:}") String sslBundle
    ) {
        if (!requireServiceAuth || !requireSecureKeys || !grpcTls || sslBundle.isBlank()) {
            throw new IllegalStateException("Production security requires authenticated endpoints, explicit credentials and TLS");
        }
    }
}
