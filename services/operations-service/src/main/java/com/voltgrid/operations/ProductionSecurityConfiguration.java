package com.voltgrid.operations;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
public final class ProductionSecurityConfiguration {

    public ProductionSecurityConfiguration(
            @Value("${voltgrid.security.require-auth:true}") boolean requireOperatorAuth,
            @Value("${voltgrid.security.jwt.issuer:}") String issuer,
            @Value("${voltgrid.security.jwt.jwk-set-uri:}") String jwks,
            @Value("${voltgrid.station-access-base-url:}") String stationAccess,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${spring.kafka.properties.security.protocol:${spring.kafka.security.protocol:PLAINTEXT}}") String kafkaSecurityProtocol
    ) {
        if (!requireOperatorAuth || !issuer.startsWith("https://") || !jwks.startsWith("https://")
                || !stationAccess.startsWith("https://")
                || !isSecureDatabaseUrl(datasourceUrl) || !isSecureKafkaProtocol(kafkaSecurityProtocol)) {
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

    public static boolean isSecureKafkaProtocol(String protocol) {
        if (protocol == null || protocol.isBlank()) {
            return false;
        }
        String upper = protocol.toUpperCase();
        return "SSL".equals(upper) || "SASL_SSL".equals(upper);
    }
}
