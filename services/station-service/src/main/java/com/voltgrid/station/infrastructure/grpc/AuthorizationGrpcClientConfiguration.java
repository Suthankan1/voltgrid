package com.voltgrid.station.infrastructure.grpc;

import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.ClientCall;
import io.grpc.ClientInterceptor;
import io.grpc.ForwardingClientCall;
import io.grpc.Metadata;
import io.grpc.MethodDescriptor;
import io.grpc.netty.NettyChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelBuilderCustomizer;

@Configuration(proxyBeanMethods = false)
public class AuthorizationGrpcClientConfiguration {

    @Value("${voltgrid.service-auth.station-service-key:${SERVICE_IDENTITY_STATION_SERVICE_KEY:}}")
    private String stationServiceKey;

    @Bean
    GrpcChannelBuilderCustomizer<NettyChannelBuilder>
    authorizationGrpcChannelCustomizer() {

        return GrpcChannelBuilderCustomizer.matching(
                "authorization",
                builder -> {
                    builder.disableRetry();
                    builder.intercept(new ClientInterceptor() {
                        @Override
                        public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
                                MethodDescriptor<ReqT, RespT> method,
                                CallOptions callOptions,
                                Channel next
                        ) {
                            return new ForwardingClientCall.SimpleForwardingClientCall<ReqT, RespT>(
                                    next.newCall(method, callOptions)
                            ) {
                                @Override
                                public void start(Listener<RespT> responseListener, Metadata headers) {
                                    headers.put(
                                            Metadata.Key.of("x-voltgrid-service-id", Metadata.ASCII_STRING_MARSHALLER),
                                            "station-service"
                                    );
                                    headers.put(
                                            Metadata.Key.of("x-voltgrid-service-key", Metadata.ASCII_STRING_MARSHALLER),
                                            stationServiceKey
                                    );
                                    super.start(responseListener, headers);
                                }
                            };
                        }
                    });
                }
        );
    }
}
