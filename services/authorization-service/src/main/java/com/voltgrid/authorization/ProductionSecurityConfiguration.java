package com.voltgrid.authorization;

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
}
