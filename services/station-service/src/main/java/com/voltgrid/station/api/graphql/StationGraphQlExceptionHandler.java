package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.StationAlreadyExistsException;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import jakarta.validation.ConstraintViolationException;
import org.springframework.graphql.data.method.annotation.GraphQlExceptionHandler;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.util.stream.Collectors;

@ControllerAdvice
public class StationGraphQlExceptionHandler {

    @GraphQlExceptionHandler
    public GraphQLError handleDuplicateStation(
            GraphqlErrorBuilder<?> errorBuilder,
            StationAlreadyExistsException exception
    ) {
        return errorBuilder
                .errorType(ErrorType.BAD_REQUEST)
                .message(exception.getMessage())
                .build();
    }

    @GraphQlExceptionHandler
    public GraphQLError handleValidation(
            GraphqlErrorBuilder<?> errorBuilder,
            ConstraintViolationException exception
    ) {
        var message = exception.getConstraintViolations()
                .stream()
                .map(violation -> violation.getMessage())
                .sorted()
                .collect(Collectors.joining(", "));

        return errorBuilder
                .errorType(ErrorType.BAD_REQUEST)
                .message(message)
                .build();
    }
}