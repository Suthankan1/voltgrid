package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionSnapshot;
import com.voltgrid.station.application.PageResult;

import java.util.List;

public record NetworkTransactionPageView(
        List<NetworkTransactionView> content,
        int page,
        int size,
        int totalElements,
        int totalPages,
        boolean hasNext
) {

    public static NetworkTransactionPageView from(
            PageResult<NetworkTransactionSnapshot> result
    ) {
        return new NetworkTransactionPageView(
                result.content()
                        .stream()
                        .map(NetworkTransactionView::from)
                        .toList(),
                result.page(),
                result.size(),
                Math.toIntExact(
                        result.totalElements()
                ),
                result.totalPages(),
                result.hasNext()
        );
    }
}