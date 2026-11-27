package com.voltgrid.authorization;

import com.voltgrid.authorization.api.grpc.GrpcAuthorizationService;
import com.voltgrid.authorization.api.grpc.ServiceAuthenticationInterceptor;
import com.voltgrid.authorization.application.AuthorizationDecisionService;
import com.voltgrid.authorization.application.TokenAuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.Server;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.NettyChannelBuilder;
import io.grpc.netty.NettyServerBuilder;
import io.grpc.stub.MetadataUtils;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.util.SelfSignedCertificate;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthorizationGrpcTlsIntegrationTests {

    private static final String SERVICE_KEY = "test-station-service-identity-key-32-chars-long!";
    private static SelfSignedCertificate serverCert;
    private static SelfSignedCertificate untrustedCert;
    private static Server tlsServer;
    private static int serverPort;

    @BeforeAll
    static void setUp() throws Exception {
        serverCert = new SelfSignedCertificate("localhost");
        untrustedCert = new SelfSignedCertificate("localhost");

        var decisionService = mock(AuthorizationDecisionService.class);
        when(decisionService.authorize(anyString(), anyString())).thenReturn(TokenAuthorizationDecision.ALLOWED);

        var grpcService = new GrpcAuthorizationService(decisionService);
        var authInterceptor = new ServiceAuthenticationInterceptor(true, SERVICE_KEY);

        SslContext serverSslContext = GrpcSslContexts.forServer(serverCert.certificate(), serverCert.privateKey()).build();

        tlsServer = NettyServerBuilder.forPort(0)
                .sslContext(serverSslContext)
                .addService(ServerInterceptors.intercept(grpcService, authInterceptor))
                .build()
                .start();

        serverPort = tlsServer.getPort();
    }

    @AfterAll
    static void tearDown() throws Exception {
        if (tlsServer != null) {
            tlsServer.shutdownNow().awaitTermination(5, TimeUnit.SECONDS);
        }
        if (serverCert != null) {
            serverCert.delete();
        }
        if (untrustedCert != null) {
            untrustedCert.delete();
        }
    }

    @Test
    void tlsClientWithTrustedCaAndValidCredentialsSucceeds() throws Exception {
        SslContext clientSslContext = GrpcSslContexts.forClient()
                .trustManager(serverCert.certificate())
                .build();

        ManagedChannel channel = NettyChannelBuilder.forAddress("localhost", serverPort)
                .sslContext(clientSslContext)
                .overrideAuthority("localhost")
                .build();

        try {
            var metadata = new Metadata();
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, SERVICE_KEY);

            var stub = AuthorizationServiceGrpc.newBlockingStub(channel)
                    .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));

            var response = stub.authorize(
                    AuthorizeRequest.newBuilder()
                            .setStationId("CS001")
                            .setIdToken("TOKEN-VALID-1")
                            .build()
            );

            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_ACCEPTED);
        } finally {
            channel.shutdownNow().awaitTermination(3, TimeUnit.SECONDS);
        }
    }

    @Test
    void plaintextClientToTlsServerFails() throws Exception {
        ManagedChannel channel = NettyChannelBuilder.forAddress("localhost", serverPort)
                .usePlaintext()
                .build();

        try {
            var metadata = new Metadata();
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, SERVICE_KEY);

            var stub = AuthorizationServiceGrpc.newBlockingStub(channel)
                    .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));

            assertThatThrownBy(() -> stub.authorize(
                    AuthorizeRequest.newBuilder()
                            .setStationId("CS001")
                            .setIdToken("TOKEN-PLAINTEXT-1")
                            .build()
            )).isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> {
                        var status = ((StatusRuntimeException) ex).getStatus();
                        assertThat(status.getCode()).isIn(Status.Code.UNAVAILABLE, Status.Code.INTERNAL);
                    });
        } finally {
            channel.shutdownNow().awaitTermination(3, TimeUnit.SECONDS);
        }
    }

    @Test
    void tlsClientWithUntrustedCaFailsHandshake() throws Exception {
        SslContext untrustedClientSslContext = GrpcSslContexts.forClient()
                .trustManager(untrustedCert.certificate())
                .build();

        ManagedChannel channel = NettyChannelBuilder.forAddress("localhost", serverPort)
                .sslContext(untrustedClientSslContext)
                .overrideAuthority("localhost")
                .build();

        try {
            var metadata = new Metadata();
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, SERVICE_KEY);

            var stub = AuthorizationServiceGrpc.newBlockingStub(channel)
                    .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));

            assertThatThrownBy(() -> stub.authorize(
                    AuthorizeRequest.newBuilder()
                            .setStationId("CS001")
                            .setIdToken("TOKEN-UNTRUSTED-1")
                            .build()
            )).isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> {
                        var status = ((StatusRuntimeException) ex).getStatus();
                        assertThat(status.getCode()).isEqualTo(Status.Code.UNAVAILABLE);
                    });
        } finally {
            channel.shutdownNow().awaitTermination(3, TimeUnit.SECONDS);
        }
    }

    @Test
    void tlsClientMissingServiceKeyFailsWithUnauthenticated() throws Exception {
        SslContext clientSslContext = GrpcSslContexts.forClient()
                .trustManager(serverCert.certificate())
                .build();

        ManagedChannel channel = NettyChannelBuilder.forAddress("localhost", serverPort)
                .sslContext(clientSslContext)
                .overrideAuthority("localhost")
                .build();

        try {
            var stub = AuthorizationServiceGrpc.newBlockingStub(channel);

            assertThatThrownBy(() -> stub.authorize(
                    AuthorizeRequest.newBuilder()
                            .setStationId("CS001")
                            .setIdToken("TOKEN-NO-KEY")
                            .build()
            )).isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> {
                        var status = ((StatusRuntimeException) ex).getStatus();
                        assertThat(status.getCode()).isEqualTo(Status.Code.UNAUTHENTICATED);
                        assertThat(status.getDescription()).contains("Missing or invalid service identity");
                    });
        } finally {
            channel.shutdownNow().awaitTermination(3, TimeUnit.SECONDS);
        }
    }

    @Test
    void tlsClientWithInvalidServiceKeyFailsWithUnauthenticated() throws Exception {
        SslContext clientSslContext = GrpcSslContexts.forClient()
                .trustManager(serverCert.certificate())
                .build();

        ManagedChannel channel = NettyChannelBuilder.forAddress("localhost", serverPort)
                .sslContext(clientSslContext)
                .overrideAuthority("localhost")
                .build();

        try {
            var metadata = new Metadata();
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, "wrong-station-service-key-at-least-32-chars!!");

            var stub = AuthorizationServiceGrpc.newBlockingStub(channel)
                    .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));

            assertThatThrownBy(() -> stub.authorize(
                    AuthorizeRequest.newBuilder()
                            .setStationId("CS001")
                            .setIdToken("TOKEN-WRONG-KEY")
                            .build()
            )).isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> {
                        var status = ((StatusRuntimeException) ex).getStatus();
                        assertThat(status.getCode()).isEqualTo(Status.Code.UNAUTHENTICATED);
                        assertThat(status.getDescription()).contains("Service authentication failed: invalid service key");
                    });
        } finally {
            channel.shutdownNow().awaitTermination(3, TimeUnit.SECONDS);
        }
    }
}
