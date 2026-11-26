package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionQueryService;
import com.voltgrid.station.application.StationQueryService;
import com.voltgrid.station.application.StationTransactionQueryService;
import com.voltgrid.station.application.TransactionCompletenessService;
import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.application.security.TenantAuthorizationService;
import com.voltgrid.station.domain.TransactionDataStatus;
import com.voltgrid.station.domain.security.Permission;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class StationTransactionGraphQlController {

    private final StationTransactionQueryService queryService;
    private final TransactionCompletenessService completenessService;
    private final NetworkTransactionQueryService networkTransactionQueryService;
    private final StationQueryService stationQueryService;
    private final TenantAuthorizationService tenantAuthorizationService;

    @Autowired
    public StationTransactionGraphQlController(
            StationTransactionQueryService queryService,
            TransactionCompletenessService completenessService,
            NetworkTransactionQueryService networkTransactionQueryService,
            @org.springframework.lang.Nullable StationQueryService stationQueryService,
            @org.springframework.lang.Nullable TenantAuthorizationService tenantAuthorizationService
    ) {
        this.queryService = queryService;
        this.completenessService = completenessService;
        this.networkTransactionQueryService = networkTransactionQueryService;
        this.stationQueryService = stationQueryService;
        this.tenantAuthorizationService = tenantAuthorizationService;
    }

    public StationTransactionGraphQlController(
            StationTransactionQueryService queryService,
            TransactionCompletenessService completenessService,
            NetworkTransactionQueryService networkTransactionQueryService
    ) {
        this(queryService, completenessService, networkTransactionQueryService, null, null);
    }

    private static final int MAX_UNPAGINATED_LIMIT = 500;
    private static final int MAX_PAGE_SIZE = 100;

    @QueryMapping
    public List<ChargingTransactionView> transactions(@Argument String organizationId) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        var list = (org != null && !org.isBlank())
                ? queryService.findByOrganizationId(org)
                : queryService.findAll();

        return list.stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(ChargingTransactionView::from)
                .toList();
    }

    public List<ChargingTransactionView> transactions() {
        return transactions(null);
    }

    @QueryMapping
    public List<NetworkTransactionView> networkTransactions(@Argument String organizationId) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        var list = (org != null && !org.isBlank())
                ? networkTransactionQueryService.findByOrganizationId(org)
                : networkTransactionQueryService.findAll();

        return list.stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(NetworkTransactionView::from)
                .toList();
    }

    public List<NetworkTransactionView> networkTransactions() {
        return networkTransactions(null);
    }

    @QueryMapping
    public NetworkTransactionPageView networkTransactionPage(
            @Argument int page,
            @Argument int size,
            @Argument String stationId,
            @Argument String transactionId,
            @Argument TransactionDataStatus integrityStatus,
            @Argument String organizationId
    ) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        int boundedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        int boundedPage = Math.max(0, page);

        if (stationId != null && !stationId.isBlank() && stationQueryService != null && org != null && !org.isBlank()) {
            var stationOpt = stationQueryService.findByIdAndOrganizationId(stationId, org);
            if (stationOpt.isEmpty()) {
                throw new TenantAccessDeniedException("Station not found or access denied: " + stationId);
            }
        }

        return NetworkTransactionPageView.from(
                networkTransactionQueryService.findPage(
                        boundedPage,
                        boundedSize,
                        new TransactionPageFilter(
                                stationId,
                                transactionId,
                                integrityStatus,
                                org
                        )
                )
        );
    }

    @QueryMapping
    public List<ChargingTransactionView> stationTransactions(
            @Argument String stationId,
            @Argument String organizationId
    ) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        var list = (org != null && !org.isBlank())
                ? queryService.findByStationIdAndOrganizationId(stationId, org)
                : queryService.findByStationId(stationId);

        return list.stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(ChargingTransactionView::from)
                .toList();
    }

    @QueryMapping
    public ChargingTransactionView transaction(
            @Argument String stationId,
            @Argument String transactionId,
            @Argument String organizationId
    ) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        if (stationQueryService != null && org != null && !org.isBlank()) {
            var stationOpt = stationQueryService.findByIdAndOrganizationId(stationId, org);
            if (stationOpt.isEmpty()) {
                throw new TenantAccessDeniedException("Station not found or access denied: " + stationId);
            }
        }

        var txOpt = (org != null && !org.isBlank())
                ? queryService.findByIdAndOrganizationId(stationId, transactionId, org)
                : queryService.findById(stationId, transactionId);

        return txOpt.map(ChargingTransactionView::from).orElse(null);
    }

    @QueryMapping
    public List<TransactionMeterSampleView> transactionMeterSamples(
            @Argument String stationId,
            @Argument String transactionId,
            @Argument String organizationId
    ) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        if (stationQueryService != null && org != null && !org.isBlank()) {
            var stationOpt = stationQueryService.findByIdAndOrganizationId(stationId, org);
            if (stationOpt.isEmpty()) {
                throw new TenantAccessDeniedException("Station not found or access denied: " + stationId);
            }
        }

        var list = (org != null && !org.isBlank())
                ? queryService.findMeterSamplesAndOrganizationId(stationId, transactionId, org)
                : queryService.findMeterSamples(stationId, transactionId);

        return list.stream()
                .limit(MAX_UNPAGINATED_LIMIT)
                .map(TransactionMeterSampleView::from)
                .toList();
    }

    @QueryMapping
    public TransactionCompletenessView transactionCompleteness(
            @Argument String stationId,
            @Argument String transactionId,
            @Argument String organizationId
    ) {
        String org = organizationId;
        if (tenantAuthorizationService != null) {
            org = tenantAuthorizationService.resolveAuthorizedOrganizationId(organizationId);
            tenantAuthorizationService.assertAuthorized(org, Permission.SESSION_READ);
        }

        if (stationQueryService != null && org != null && !org.isBlank()) {
            var stationOpt = stationQueryService.findByIdAndOrganizationId(stationId, org);
            if (stationOpt.isEmpty()) {
                throw new TenantAccessDeniedException("Station not found or access denied: " + stationId);
            }
        }

        return TransactionCompletenessView.from(
                completenessService.calculate(
                        stationId,
                        transactionId
                )
        );
    }
}
