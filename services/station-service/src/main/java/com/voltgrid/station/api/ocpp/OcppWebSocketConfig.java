package com.voltgrid.station.api.ocpp;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class OcppWebSocketConfig implements WebSocketConfigurer {

    private final OcppWebSocketHandler handler;
    private final OcppHandshakeInterceptor handshakeInterceptor;

    public OcppWebSocketConfig(
            OcppWebSocketHandler handler,
            OcppHandshakeInterceptor handshakeInterceptor
    ) {
        this.handler = handler;
        this.handshakeInterceptor = handshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry
    ) {
        registry.addHandler(handler, "/ocpp/*")
                .addInterceptors(handshakeInterceptor);
    }
}