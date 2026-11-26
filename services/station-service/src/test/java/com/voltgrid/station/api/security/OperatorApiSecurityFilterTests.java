package com.voltgrid.station.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatorApiSecurityFilterTests {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @Test
    void shouldPermitWhenNoTokenConfigured() throws Exception {
        var filter = new OperatorApiSecurityFilter("");

        when(request.getRequestURI()).thenReturn("/graphql");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldPermitWhenValidBearerTokenProvided() throws Exception {
        var filter = new OperatorApiSecurityFilter("test-secret-token");

        when(request.getRequestURI()).thenReturn("/graphql");
        when(request.getHeader("Authorization")).thenReturn("Bearer test-secret-token");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldRejectWhenInvalidBearerTokenProvided() throws Exception {
        var filter = new OperatorApiSecurityFilter("test-secret-token");
        var stringWriter = new StringWriter();

        when(request.getRequestURI()).thenReturn("/graphql");
        when(request.getHeader("Authorization")).thenReturn("Bearer wrong-token");
        when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(filterChain, never()).doFilter(request, response);
        assertThat(stringWriter.toString()).contains("Unauthorized");
    }
}
