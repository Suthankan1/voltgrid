package com.voltgrid.station.infrastructure.grpc;

import io.grpc.netty.NettyChannelBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelBuilderCustomizer;

@Configuration(proxyBeanMethods = false)
public class AuthorizationGrpcClientConfiguration {

    @Bean
    GrpcChannelBuilderCustomizer<NettyChannelBuilder>
    authorizationGrpcChannelCustomizer() {

        return GrpcChannelBuilderCustomizer.matching(
                "authorization",
                builder -> builder.disableRetry()
        );
    }
}