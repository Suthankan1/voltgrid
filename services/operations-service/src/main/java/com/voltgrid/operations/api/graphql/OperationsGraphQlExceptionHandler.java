package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.application.InvalidStationStatusPageSizeException;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import org.springframework.graphql.data.method.annotation.GraphQlExceptionHandler;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.util.Map;

@ControllerAdvice
public class OperationsGraphQlExceptionHandler {

    @GraphQlExceptionHandler
    public GraphQLError handleInvalidStationStatusPageSize(
            GraphqlErrorBuilder<?> errorBuilder,
            InvalidStationStatusPageSizeException exception
    ) {
        return errorBuilder
                .errorType(
                        ErrorType.BAD_REQUEST
                )
                .message(
                        exception.getMessage()
                )
                .extensions(
                        Map.of(
                                "code",
                                "INVALID_PAGE_SIZE"
                        )
                )
                .build();
    }
}