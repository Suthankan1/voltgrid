package com.voltgrid.station.infrastructure.grpc;

import io.grpc.netty.NettyChannelBuilder;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AuthorizationGrpcClientConfigurationTests {

    private final AuthorizationGrpcClientConfiguration configuration =
            new AuthorizationGrpcClientConfiguration();

    @Test
    void shouldDisableRetriesForAuthorizationChannel() {
        var builder =
                mock(NettyChannelBuilder.class);

        var customizer =
                configuration
                        .authorizationGrpcChannelCustomizer();

        customizer.customize(
                "authorization",
                builder
        );

        verify(builder)
                .disableRetry();
    }

    @Test
    void shouldNotDisableRetriesForOtherChannels() {
        var builder =
                mock(NettyChannelBuilder.class);

        var customizer =
                configuration
                        .authorizationGrpcChannelCustomizer();

        customizer.customize(
                "some-other-service",
                builder
        );

        verify(builder, never())
                .disableRetry();
    }
}