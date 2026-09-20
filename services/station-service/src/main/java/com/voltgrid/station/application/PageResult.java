package com.voltgrid.station.application;

import java.util.List;

public record PageResult<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {

    public PageResult {
        content = List.copyOf(content);
    }
}