package com.voltgrid.operations.api.graphql;

import com.voltgrid.operations.api.security.SecurityContext;
import com.voltgrid.operations.application.StationStatusQueryService;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.data.domain.Window;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.query.ScrollSubrange;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Controller
public class StationStatusGraphQlController {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final StationStatusQueryService queryService;

    @Value("${voltgrid.security.require-auth:true}")
    private boolean requireAuth = true;

    public StationStatusGraphQlController(
            StationStatusQueryService queryService
    ) {
        this.queryService = queryService;
    }

    @QueryMapping
    public StationStatusView stationStatus(
            @Argument String stationId,
            @Argument String organizationId
    ) {
        String targetOrg = authorizedOrganization(organizationId);

        return queryService.findByStationIdAndOrganizationId(
                stationId,
                targetOrg
        );
    }

    @QueryMapping
    public Window<StationStatusView> stationStatuses(
            @Argument("status")
            StationOperationalStatus status,
            @Argument
            String organizationId,
            ScrollSubrange subrange
    ) {
        String targetOrg = authorizedOrganization(organizationId);

        var position =
                subrange
                        .position()
                        .orElse(
                                ScrollPosition.keyset()
                        );

        var count =
                subrange
                        .count()
                        .orElse(
                                DEFAULT_PAGE_SIZE
                        );

        return queryService.findAllByOrganizationId(
                position,
                count,
                status,
                targetOrg
        );
    }
    private String authorizedOrganization(String requestedOrganizationId) {
        var user = SecurityContext.get();
        if (user == null) {
            if (requireAuth) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization access denied");
            return requestedOrganizationId;
        }
        if (requestedOrganizationId != null && !requestedOrganizationId.equals(user.activeOrganizationId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Organization access denied");
        }
        return user.activeOrganizationId();
    }
}
