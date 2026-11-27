package com.voltgrid.station;

import java.sql.SQLException;
import java.util.Properties;

import org.postgresql.Driver;
import org.postgresql.PGProperty;
import org.postgresql.jdbc.GSSEncMode;
import org.postgresql.jdbc.SslMode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"prod", "production"})
public final class ProductionSecurityConfiguration {

    public ProductionSecurityConfiguration(
            @Value("${voltgrid.security.require-auth:true}") boolean requireOperatorAuth,
            @Value("${voltgrid.ocpp.auth-required:true}") boolean requireDeviceAuth,
            @Value("${voltgrid.ocpp.require-secure-transport:true}") boolean requireSecureTransport,
            @Value("${spring.grpc.client.channel.authorization.ssl.enabled:true}") boolean grpcTls,
            @Value("${voltgrid.security.jwt.issuer:}") String issuer,
            @Value("${voltgrid.security.jwt.jwk-set-uri:}") String jwks,
            @Value("${voltgrid.service-auth.station-service-key:${SERVICE_IDENTITY_STATION_SERVICE_KEY:}}") String stationKey,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${spring.kafka.properties.security.protocol:${spring.kafka.security.protocol:PLAINTEXT}}") String kafkaSecurityProtocol
    ) {
        if (!requireOperatorAuth || !requireDeviceAuth || !requireSecureTransport || !grpcTls || stationKey.length() < 32
                || !issuer.startsWith("https://") || !jwks.startsWith("https://")
                || !isSecureDatabaseUrl(datasourceUrl) || !isSecureKafkaProtocol(kafkaSecurityProtocol)) {
            throw new IllegalStateException("Production security requires authenticated endpoints, explicit credentials and TLS");
        }
    }

    public static boolean isSecureDatabaseUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        Properties properties = Driver.parseURL(url, null);
        if (properties == null
                || PGProperty.SSL_FACTORY.isPresent(properties)
                || PGProperty.SSL_HOSTNAME_VERIFIER.isPresent(properties)) {
            return false;
        }
        try {
            GSSEncMode gssMode = GSSEncMode.of(properties);
            return SslMode.of(properties) == SslMode.VERIFY_FULL
                    && (gssMode == GSSEncMode.DISABLE || gssMode == GSSEncMode.ALLOW);
        } catch (SQLException invalidConnectionProperty) {
            return false;
        }
    }

    public static boolean isSecureKafkaProtocol(String protocol) {
        if (protocol == null || protocol.isBlank()) {
            return false;
        }
        String upper = protocol.toUpperCase();
        return "SSL".equals(upper) || "SASL_SSL".equals(upper);
    }
}
