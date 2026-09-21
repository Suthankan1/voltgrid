package com.voltgrid.station.infrastructure.persistence.jpa;

import com.voltgrid.station.application.PageResult;
import com.voltgrid.station.application.StationTransactionReader;
import com.voltgrid.station.application.TransactionPageFilter;
import com.voltgrid.station.domain.ChargingTransaction;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class JpaStationTransactionReader
        implements StationTransactionReader {

    private final ChargingTransactionJpaRepository repository;

    public JpaStationTransactionReader(
            ChargingTransactionJpaRepository repository
    ) {
        this.repository = repository;
    }

    @Override
    public Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    ) {
        return repository
                .findById(
                        new ChargingTransactionId(
                                stationId,
                                transactionId
                        )
                )
                .map(this::toDomain);
    }

    @Override
    public Optional<ChargingTransaction> findByIdForUpdate(
            String stationId,
            String transactionId
    ) {
        return repository
                .findByIdForUpdate(
                        stationId,
                        transactionId
                )
                .map(this::toDomain);
    }

    @Override
    public List<ChargingTransaction> findAll() {
        return repository
                .findAllByOrderByStartedAtDescIdStationIdAscIdTransactionIdAsc()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public List<ChargingTransaction> findByStationId(
            String stationId
    ) {
        return repository
                .findByIdStationIdOrderByStartedAtDesc(
                        stationId
                )
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public PageResult<ChargingTransaction> findPage(
            int page,
            int size,
            TransactionPageFilter filter
    ) {
        var pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.desc(
                                "startedAt"
                        ),
                        Sort.Order.asc(
                                "id.stationId"
                        ),
                        Sort.Order.asc(
                                "id.transactionId"
                        )
                )
        );

        var result = repository.findAll(
                specification(filter),
                pageable
        );

        return new PageResult<>(
                result
                        .getContent()
                        .stream()
                        .map(this::toDomain)
                        .toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext()
        );
    }

    private Specification<ChargingTransactionEntity>
    specification(
            TransactionPageFilter filter
    ) {
        return (
                root,
                query,
                criteriaBuilder
        ) -> {
            var predicates =
                    new ArrayList<Predicate>();

            if (filter.stationId() != null) {
                predicates.add(
                        criteriaBuilder.equal(
                                root
                                        .get("id")
                                        .get("stationId"),
                                filter.stationId()
                        )
                );
            }

            if (filter.transactionId() != null) {
                var pattern =
                        "%"
                                + escapeLike(
                                        filter
                                                .transactionId()
                                                .toLowerCase(
                                                        Locale.ROOT
                                                )
                                )
                                + "%";

                predicates.add(
                        criteriaBuilder.like(
                                criteriaBuilder.lower(
                                        root
                                                .get("id")
                                                .get("transactionId")
                                ),
                                pattern,
                                '\\'
                        )
                );
            }

            if (filter.integrityStatus() != null) {
                var integritySubquery =
                        query.subquery(
                                Integer.class
                        );

                var integrity =
                        integritySubquery.from(
                                TransactionIntegrityStatusEntity.class
                        );

                integritySubquery.select(
                        criteriaBuilder.literal(1)
                );

                integritySubquery.where(
                        criteriaBuilder.equal(
                                integrity
                                        .get("id")
                                        .get("stationId"),
                                root
                                        .get("id")
                                        .get("stationId")
                        ),
                        criteriaBuilder.equal(
                                integrity
                                        .get("id")
                                        .get("transactionId"),
                                root
                                        .get("id")
                                        .get("transactionId")
                        ),
                        criteriaBuilder.equal(
                                integrity.get(
                                        "integrityStatus"
                                ),
                                filter.integrityStatus()
                        )
                );

                predicates.add(
                        criteriaBuilder.exists(
                                integritySubquery
                        )
                );
            }

            return criteriaBuilder.and(
                    predicates.toArray(
                            Predicate[]::new
                    )
            );
        };
    }

    private String escapeLike(
            String value
    ) {
        return value
                .replace(
                        "\\",
                        "\\\\"
                )
                .replace(
                        "%",
                        "\\%"
                )
                .replace(
                        "_",
                        "\\_"
                );
    }

    private ChargingTransaction toDomain(
            ChargingTransactionEntity entity
    ) {
        return new ChargingTransaction(
                entity
                        .getId()
                        .getStationId(),
                entity
                        .getId()
                        .getTransactionId(),
                entity.getEvseId(),
                entity.getConnectorId(),
                entity.getStatus(),
                entity.getStartedAt(),
                entity.getEndedAt(),
                entity.getLastSequenceNumber()
        );
    }
}