package com.voltgrid.operations.infrastructure.graphql;

import com.voltgrid.operations.application.StationStatusQueryService;
import graphql.ExecutionResult;
import graphql.analysis.FieldComplexityEnvironment;
import graphql.analysis.MaxQueryComplexityInstrumentation;
import graphql.analysis.MaxQueryDepthInstrumentation;
import graphql.execution.AbortExecutionException;
import graphql.execution.instrumentation.Instrumentation;
import graphql.execution.instrumentation.InstrumentationContext;
import graphql.execution.instrumentation.InstrumentationState;
import graphql.execution.instrumentation.parameters.InstrumentationExecuteOperationParameters;
import graphql.language.Field;
import graphql.language.Node;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.util.ArrayDeque;

@Configuration(proxyBeanMethods = false)
public class GraphQlSecurityConfiguration {

    public static final int MAX_QUERY_DEPTH = 15;
    private static final int MAX_ALIASES = 20;
    private static final int MAX_QUERY_COMPLEXITY = 1_500;

    @Bean
    @Order(0)
    public Instrumentation maxQueryDepthInstrumentation() {
        return new MaxQueryDepthInstrumentation(MAX_QUERY_DEPTH);
    }

    @Bean
    @Order(1)
    public Instrumentation queryWorkloadInstrumentation() {
        return new MaxQueryComplexityInstrumentation(MAX_QUERY_COMPLEXITY,
                GraphQlSecurityConfiguration::fieldCost) {
            @Override
            public InstrumentationContext<ExecutionResult> beginExecuteOperation(
                    InstrumentationExecuteOperationParameters parameters, InstrumentationState state) {
                enforceAliasLimit(parameters.getExecutionContext().getDocument());
                return super.beginExecuteOperation(parameters, state);
            }
        };
    }

    private static void enforceAliasLimit(Node<?> document) {
        var pending = new ArrayDeque<Node<?>>();
        pending.add(document);
        int aliases = 0;
        while (!pending.isEmpty()) {
            Node<?> node = pending.removeLast();
            if (node instanceof Field field && field.getAlias() != null && ++aliases > MAX_ALIASES) {
                throw new AbortExecutionException("maximum GraphQL alias count exceeded (" + MAX_ALIASES + ")");
            }
            node.getChildren().forEach(pending::addLast);
        }
    }

    private static int fieldCost(FieldComplexityEnvironment field, int childComplexity) {
        if (!"stationStatuses".equals(field.getFieldDefinition().getName())) {
            return 1 + childComplexity;
        }

        // Use the same page bounds as the resolver. The resolver retains its page-size error contract.
        var requestedSize = (Integer) field.getArguments().get("first");
        int pageSize = requestedSize == null
                ? StationStatusQueryService.DEFAULT_PAGE_SIZE
                : Math.clamp(requestedSize, 1, StationStatusQueryService.MAX_PAGE_SIZE);
        return 1 + pageSize * (1 + Math.min(MAX_QUERY_COMPLEXITY, childComplexity));
    }
}
