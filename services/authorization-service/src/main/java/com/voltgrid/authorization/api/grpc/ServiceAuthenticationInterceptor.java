package com.voltgrid.authorization.api.grpc;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.grpc.server.GlobalServerInterceptor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
@GlobalServerInterceptor
@Order(1)
public class ServiceAuthenticationInterceptor implements ServerInterceptor {

    public static final Metadata.Key<String> SERVICE_ID_HEADER =
            Metadata.Key.of("x-voltgrid-service-id", Metadata.ASCII_STRING_MARSHALLER);
    public static final Metadata.Key<String> SERVICE_KEY_HEADER =
            Metadata.Key.of("x-voltgrid-service-key", Metadata.ASCII_STRING_MARSHALLER);

    private final boolean serviceAuthEnabled;
    private final String expectedServiceKey;

    public ServiceAuthenticationInterceptor(
            @Value("${voltgrid.service-auth.enabled:true}") boolean serviceAuthEnabled,
            @Value("${voltgrid.service-auth.service-keys.station-service:${SERVICE_IDENTITY_STATION_SERVICE_KEY:}}") String expectedServiceKey
    ) {
        this.serviceAuthEnabled = serviceAuthEnabled;
        this.expectedServiceKey = expectedServiceKey != null ? expectedServiceKey.trim() : "";

        if (serviceAuthEnabled && (this.expectedServiceKey.length() < 32
                || "voltgrid-station-service-secret-key".equals(this.expectedServiceKey))) {
            throw new IllegalStateException("A non-default station-service identity key of at least 32 characters is required");
        }
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next
    ) {
        var method = call.getMethodDescriptor();
        if (!serviceAuthEnabled || (method != null && "grpc.health.v1.Health/Check".equals(method.getFullMethodName()))) {
            return next.startCall(call, headers);
        }

        String serviceId = headers.get(SERVICE_ID_HEADER);
        String serviceKey = headers.get(SERVICE_KEY_HEADER);

        if (serviceId == null || serviceKey == null || !"station-service".equals(serviceId)) {
            call.close(
                    Status.UNAUTHENTICATED.withDescription("Missing or invalid service identity"),
                    new Metadata()
            );
            return new ServerCall.Listener<ReqT>() {};
        }

        if (expectedServiceKey.isEmpty() || !MessageDigest.isEqual(
                expectedServiceKey.getBytes(StandardCharsets.UTF_8),
                serviceKey.getBytes(StandardCharsets.UTF_8)
        )) {
            call.close(
                    Status.UNAUTHENTICATED.withDescription("Service authentication failed: invalid service key"),
                    new Metadata()
            );
            return new ServerCall.Listener<ReqT>() {};
        }

        return next.startCall(call, headers);
    }
}
