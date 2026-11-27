package com.voltgrid.authorization;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
public final class ProductionSecurityConfiguration {

    public ProductionSecurityConfiguration(
            @Value("${voltgrid.service-auth.enabled:true}") boolean requireServiceAuth,
            @Value("${voltgrid.security.require-secure-keys:true}") boolean requireSecureKeys,
            @Value("${spring.grpc.server.ssl.enabled:false}") boolean grpcTls,
            @Value("${spring.grpc.server.ssl.bundle:}") String sslBundle,
            @Value("${spring.datasource.url:}") String datasourceUrl
    ) {
        if (!requireServiceAuth || !requireSecureKeys || !grpcTls || sslBundle.isBlank()
                || !isSecureDatabaseUrl(datasourceUrl)) {
            throw new IllegalStateException("Production security requires authenticated endpoints, explicit credentials and TLS");
        }
    }

    public static boolean isSecureDatabaseUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase();
        return lower.contains("sslmode=verify-full") || lower.contains("sslmode=verify-ca") || lower.contains("ssl=true");
    }
}
