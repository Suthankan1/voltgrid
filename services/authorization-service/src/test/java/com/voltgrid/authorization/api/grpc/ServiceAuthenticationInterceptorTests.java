package com.voltgrid.authorization.api.grpc;

import io.grpc.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceAuthenticationInterceptorTests {

    @Mock
    private ServerCall<String, String> serverCall;

    @Mock
    private ServerCallHandler<String, String> nextHandler;

    @Mock
    private ServerCall.Listener<String> listener;

    @Test
    void shouldPassThroughWhenServiceAuthDisabled() {
        var interceptor = new ServiceAuthenticationInterceptor(false, "secret");
        var headers = new Metadata();

        when(nextHandler.startCall(serverCall, headers)).thenReturn(listener);

        var result = interceptor.interceptCall(serverCall, headers, nextHandler);

        assertThat(result).isSameAs(listener);
        verify(nextHandler).startCall(serverCall, headers);
        verify(serverCall, never()).close(any(), any());
    }

    @Test
    void shouldAcceptCallWithValidServiceCredentials() {
        var interceptor = new ServiceAuthenticationInterceptor(true, "test-only-service-key-at-least-32-characters");
        var headers = new Metadata();
        headers.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
        headers.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, "test-only-service-key-at-least-32-characters");

        when(nextHandler.startCall(serverCall, headers)).thenReturn(listener);

        var result = interceptor.interceptCall(serverCall, headers, nextHandler);

        assertThat(result).isSameAs(listener);
        verify(nextHandler).startCall(serverCall, headers);
        verify(serverCall, never()).close(any(), any());
    }

    @Test
    void shouldRejectCallWithMissingServiceCredentials() {
        var interceptor = new ServiceAuthenticationInterceptor(true, "test-only-service-key-at-least-32-characters");
        var headers = new Metadata();

        interceptor.interceptCall(serverCall, headers, nextHandler);

        var statusCaptor = ArgumentCaptor.forClass(Status.class);
        verify(serverCall).close(statusCaptor.capture(), any());
        assertThat(statusCaptor.getValue().getCode()).isEqualTo(Status.Code.UNAUTHENTICATED);
        verify(nextHandler, never()).startCall(any(), any());
    }

    @Test
    void shouldRejectCallWithInvalidServiceKey() {
        var interceptor = new ServiceAuthenticationInterceptor(true, "test-only-service-key-at-least-32-characters");
        var headers = new Metadata();
        headers.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "station-service");
        headers.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, "wrong-key");

        interceptor.interceptCall(serverCall, headers, nextHandler);

        var statusCaptor = ArgumentCaptor.forClass(Status.class);
        verify(serverCall).close(statusCaptor.capture(), any());
        assertThat(statusCaptor.getValue().getCode()).isEqualTo(Status.Code.UNAUTHENTICATED);
        verify(nextHandler, never()).startCall(any(), any());
    }

    @Test
    void shouldRejectCallWithUnknownServiceId() {
        var interceptor = new ServiceAuthenticationInterceptor(true, "test-only-service-key-at-least-32-characters");
        var headers = new Metadata();
        headers.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, "rogue-service");
        headers.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, "test-only-service-key-at-least-32-characters");

        interceptor.interceptCall(serverCall, headers, nextHandler);

        var statusCaptor = ArgumentCaptor.forClass(Status.class);
        verify(serverCall).close(statusCaptor.capture(), any());
        assertThat(statusCaptor.getValue().getCode()).isEqualTo(Status.Code.UNAUTHENTICATED);
    }
}
