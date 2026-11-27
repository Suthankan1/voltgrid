package com.voltgrid.operations.infrastructure.graphql;

import graphql.analysis.MaxQueryDepthInstrumentation;
import graphql.execution.instrumentation.Instrumentation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class GraphQlSecurityConfiguration {

    public static final int MAX_QUERY_DEPTH = 15;

    @Bean
    public Instrumentation maxQueryDepthInstrumentation() {
        return new MaxQueryDepthInstrumentation(MAX_QUERY_DEPTH);
    }
}
