package com.voltgrid.authorization.api.grpc;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class ServiceAuthenticationInterceptor implements ServerInterceptor {

    public static final Metadata.Key<String> SERVICE_ID_HEADER =
            Metadata.Key.of("x-voltgrid-service-id", Metadata.ASCII_STRING_MARSHALLER);
    public static final Metadata.Key<String> SERVICE_KEY_HEADER =
            Metadata.Key.of("x-voltgrid-service-key", Metadata.ASCII_STRING_MARSHALLER);

    private final boolean serviceAuthEnabled;
    private final String expectedServiceKey;

    public ServiceAuthenticationInterceptor(
            @Value("${voltgrid.service-auth.enabled:false}") boolean serviceAuthEnabled,
            @Value("${voltgrid.service-auth.service-keys.station-service:voltgrid-station-service-secret-key}") String expectedServiceKey
    ) {
        this.serviceAuthEnabled = serviceAuthEnabled;
        this.expectedServiceKey = expectedServiceKey != null ? expectedServiceKey.trim() : "";
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next
    ) {
        if (!serviceAuthEnabled) {
            return next.startCall(call, headers);
        }

        String serviceId = headers.get(SERVICE_ID_HEADER);
        String serviceKey = headers.get(SERVICE_KEY_HEADER);

        if (!"station-service".equals(serviceId) || expectedServiceKey.isEmpty() || !expectedServiceKey.equals(serviceKey)) {
            call.close(Status.UNAUTHENTICATED.withDescription("Invalid or missing service credentials"), new Metadata());
            return new ServerCall.Listener<ReqT>() {};
        }

        return next.startCall(call, headers);
    }
}
