package com.voltgrid.station.application;

import com.voltgrid.station.application.security.TenantAccessDeniedException;
import com.voltgrid.station.domain.CommandStatus;
import com.voltgrid.station.domain.StationCommand;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCommandEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCommandJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class StationCommandService {

    private static final Logger log = LoggerFactory.getLogger(StationCommandService.class);
    private static final Duration DEFAULT_COMMAND_TIMEOUT = Duration.ofSeconds(30);

    private final StationCommandJpaRepository repository;
    private final ChargingStationJpaRepository chargingStationRepository;
    private final JsonMapper jsonMapper;
    private final TransactionTemplate transactionTemplate;
    private OcppCommandSender commandSender;

    @Autowired
    public StationCommandService(
            StationCommandJpaRepository repository,
            @Autowired(required = false) ChargingStationJpaRepository chargingStationRepository,
            JsonMapper jsonMapper,
            PlatformTransactionManager transactionManager
    ) {
        this.repository = repository;
        this.chargingStationRepository = chargingStationRepository;
        this.jsonMapper = jsonMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public StationCommandService(
            StationCommandJpaRepository repository,
            JsonMapper jsonMapper,
            PlatformTransactionManager transactionManager
    ) {
        this(repository, null, jsonMapper, transactionManager);
    }

    @Autowired(required = false)
    public void setCommandSender(@org.springframework.context.annotation.Lazy OcppCommandSender commandSender) {
        this.commandSender = commandSender;
    }

    public StationCommand requestStartTransaction(
            String stationId,
            int evseId,
            String idToken,
            String remoteStartId,
            String idempotencyKey
    ) {
        if (evseId < 0) {
            throw new IllegalArgumentException("evseId must not be negative: " + evseId);
        }

        int parsedRemoteStartId;
        if (remoteStartId != null && !remoteStartId.isBlank()) {
            try {
                parsedRemoteStartId = Integer.parseInt(remoteStartId.trim());
                if (parsedRemoteStartId <= 0) {
                    throw new IllegalArgumentException("remoteStartId must be positive: " + remoteStartId);
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid remoteStartId: " + remoteStartId, e);
            }
        } else {
            parsedRemoteStartId = ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE);
        }

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
            if (existing.isPresent()) {
                var entity = existing.get();
                if (entity.getEvseId() != null && entity.getEvseId() != evseId) {
                    throw new ConflictingCommandException("Conflicting evseId for idempotency key " + idempotencyKey);
                }
                if (entity.getRemoteStartId() != null && entity.getRemoteStartId() != parsedRemoteStartId) {
                    throw new ConflictingCommandException("Conflicting remoteStartId for idempotency key " + idempotencyKey);
                }
                if (!"RequestStartTransaction".equals(entity.getAction())) {
                    throw new ConflictingCommandException("Conflicting action for idempotency key " + idempotencyKey);
                }
                return toDomain(entity);
            }
        }

        UUID commandId = UUID.randomUUID();
        String messageId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(DEFAULT_COMMAND_TIMEOUT);

        // Build wire payload with raw idToken
        var wireNode = jsonMapper.createObjectNode();
        wireNode.put("evseId", evseId);
        wireNode.put("remoteStartId", parsedRemoteStartId);
        var wireIdToken = wireNode.putObject("idToken");
        wireIdToken.put("idToken", idToken != null ? idToken : "");
        wireIdToken.put("type", "ISO14443");
        String wirePayloadJson = jsonMapper.writeValueAsString(wireNode);

        // Build persisted payload with redacted idToken to prevent PII / credential leakage in database
        var persistedNode = jsonMapper.createObjectNode();
        persistedNode.put("evseId", evseId);
        persistedNode.put("remoteStartId", parsedRemoteStartId);
        var persistedIdToken = persistedNode.putObject("idToken");
        persistedIdToken.put("idToken", "[REDACTED]");
        persistedIdToken.put("type", "ISO14443");
        String persistedPayloadJson = jsonMapper.writeValueAsString(persistedNode);

        var entity = new StationCommandEntity(
                commandId,
                stationId,
                messageId,
                "RequestStartTransaction",
                CommandStatus.REQUESTED,
                idempotencyKey,
                persistedPayloadJson,
                now,
                expiresAt
        );
        entity.setRemoteStartId(parsedRemoteStartId);
        entity.setEvseId(evseId);

        // Dispatch safety: Never dispatch inside an uncommitted transaction.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            StationCommandEntity saved;
            try {
                saved = repository.save(entity);
            } catch (DataIntegrityViolationException dive) {
                if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                    var conflict = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
                    if (conflict.isPresent()) {
                        return toDomain(checkConflictAndReturn(conflict.get(), evseId, parsedRemoteStartId, null, "RequestStartTransaction", idempotencyKey));
                    }
                }
                throw dive;
            }

            final UUID finalCommandId = saved.getId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    boolean sent = commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStartTransaction", wirePayloadJson);
                    transactionTemplate.execute(status -> {
                        repository.findById(finalCommandId).ifPresent(cmd -> {
                            cmd.setStatus(sent ? CommandStatus.PENDING : CommandStatus.REJECTED);
                            if (!sent) {
                                cmd.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected or send failed\"}");
                            }
                            repository.save(cmd);
                        });
                        return null;
                    });
                }
            });
            return toDomain(saved);
        }

        // Standalone dispatch: Commit the REQUESTED entity before sending over WebSocket
        StationCommandEntity committedEntity;
        try {
            committedEntity = transactionTemplate.execute(status -> repository.save(entity));
        } catch (DataIntegrityViolationException dive) {
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                var conflict = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
                if (conflict.isPresent()) {
                    return toDomain(checkConflictAndReturn(conflict.get(), evseId, parsedRemoteStartId, null, "RequestStartTransaction", idempotencyKey));
                }
            }
            throw dive;
        }

        boolean sent = commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStartTransaction", wirePayloadJson);

        final boolean finalSent = sent;
        final UUID finalCommandId = committedEntity.getId();
        committedEntity = transactionTemplate.execute(status -> {
            var cmd = repository.findById(finalCommandId).orElseThrow();
            cmd.setStatus(finalSent ? CommandStatus.PENDING : CommandStatus.REJECTED);
            if (!finalSent) {
                cmd.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected\"}");
            }
            return repository.save(cmd);
        });

        return toDomain(committedEntity);
    }

    public StationCommand requestStopTransaction(
            String stationId,
            String transactionId,
            String idempotencyKey
    ) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("transactionId must not be blank");
        }

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
            if (existing.isPresent()) {
                var entity = existing.get();
                if (entity.getTransactionId() != null && !entity.getTransactionId().equals(transactionId)) {
                    throw new ConflictingCommandException("Conflicting transactionId for idempotency key " + idempotencyKey);
                }
                if (!"RequestStopTransaction".equals(entity.getAction())) {
                    throw new ConflictingCommandException("Conflicting action for idempotency key " + idempotencyKey);
                }
                return toDomain(entity);
            }
        }

        UUID commandId = UUID.randomUUID();
        String messageId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(DEFAULT_COMMAND_TIMEOUT);

        var payloadNode = jsonMapper.createObjectNode();
        payloadNode.put("transactionId", transactionId);
        String payloadJson = jsonMapper.writeValueAsString(payloadNode);

        var entity = new StationCommandEntity(
                commandId,
                stationId,
                messageId,
                "RequestStopTransaction",
                CommandStatus.REQUESTED,
                idempotencyKey,
                payloadJson,
                now,
                expiresAt
        );
        entity.setTransactionId(transactionId);

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            StationCommandEntity saved;
            try {
                saved = repository.save(entity);
            } catch (DataIntegrityViolationException dive) {
                if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                    var conflict = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
                    if (conflict.isPresent()) {
                        return toDomain(checkConflictAndReturn(conflict.get(), null, null, transactionId, "RequestStopTransaction", idempotencyKey));
                    }
                }
                throw dive;
            }

            final UUID finalCommandId = saved.getId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    boolean sent = commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStopTransaction", payloadJson);
                    transactionTemplate.execute(status -> {
                        repository.findById(finalCommandId).ifPresent(cmd -> {
                            cmd.setStatus(sent ? CommandStatus.PENDING : CommandStatus.REJECTED);
                            if (!sent) {
                                cmd.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected or send failed\"}");
                            }
                            repository.save(cmd);
                        });
                        return null;
                    });
                }
            });
            return toDomain(saved);
        }

        StationCommandEntity committedEntity;
        try {
            committedEntity = transactionTemplate.execute(status -> repository.save(entity));
        } catch (DataIntegrityViolationException dive) {
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                var conflict = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
                if (conflict.isPresent()) {
                    return toDomain(checkConflictAndReturn(conflict.get(), null, null, transactionId, "RequestStopTransaction", idempotencyKey));
                }
            }
            throw dive;
        }

        boolean sent = commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStopTransaction", payloadJson);

        final boolean finalSent = sent;
        final UUID finalCommandId = committedEntity.getId();
        committedEntity = transactionTemplate.execute(status -> {
            var cmd = repository.findById(finalCommandId).orElseThrow();
            cmd.setStatus(finalSent ? CommandStatus.PENDING : CommandStatus.REJECTED);
            if (!finalSent) {
                cmd.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected\"}");
            }
            return repository.save(cmd);
        });

        return toDomain(committedEntity);
    }

    private StationCommandEntity checkConflictAndReturn(
            StationCommandEntity entity,
            Integer evseId,
            Integer remoteStartId,
            String transactionId,
            String expectedAction,
            String idempotencyKey
    ) {
        if (!expectedAction.equals(entity.getAction())) {
            throw new ConflictingCommandException("Conflicting action for idempotency key " + idempotencyKey);
        }
        if (evseId != null && entity.getEvseId() != null && !evseId.equals(entity.getEvseId())) {
            throw new ConflictingCommandException("Conflicting evseId for idempotency key " + idempotencyKey);
        }
        if (remoteStartId != null && entity.getRemoteStartId() != null && !remoteStartId.equals(entity.getRemoteStartId())) {
            throw new ConflictingCommandException("Conflicting remoteStartId for idempotency key " + idempotencyKey);
        }
        if (transactionId != null && entity.getTransactionId() != null && !transactionId.equals(entity.getTransactionId())) {
            throw new ConflictingCommandException("Conflicting transactionId for idempotency key " + idempotencyKey);
        }
        return entity;
    }

    @Transactional
    public void handleCommandResponse(
            String stationId,
            String messageId,
            String responsePayload
    ) {
        var existing = repository.findByStationIdAndMessageId(stationId, messageId);
        if (existing.isEmpty()) {
            log.warn("Received response for unknown command messageId={}", messageId);
            return;
        }

        var entity = existing.get();

        // Terminal & Observed state protection: Never overwrite terminal or observed states
        if (entity.getStatus() == CommandStatus.OBSERVED
                || entity.getStatus() == CommandStatus.TIMED_OUT
                || entity.getStatus() == CommandStatus.REJECTED
                || entity.getStatus() == CommandStatus.UNCERTAIN) {
            log.warn("Ignoring late CALL_RESULT for command {} in terminal/observed state {}", entity.getId(), entity.getStatus());
            return;
        }

        if (entity.getStatus() == CommandStatus.ACCEPTED) {
            // Duplicate CALL_RESULT: idempotent no-op
            return;
        }

        entity.setRespondedAt(Instant.now());
        entity.setResponsePayload(responsePayload);

        boolean isAccepted = false;
        try {
            var node = jsonMapper.readTree(responsePayload);
            if (node.has("status") && "Accepted".equalsIgnoreCase(node.get("status").asText())) {
                isAccepted = true;
            }
        } catch (Exception ex) {
            log.warn("Error parsing CALL_RESULT payload: {}", responsePayload);
        }

        entity.setStatus(isAccepted ? CommandStatus.ACCEPTED : CommandStatus.REJECTED);
        repository.save(entity);
    }

    @Transactional
    public void handleCommandError(
            String stationId,
            String messageId,
            String errorCode,
            String errorDescription
    ) {
        var existing = repository.findByStationIdAndMessageId(stationId, messageId);
        if (existing.isEmpty()) {
            return;
        }

        var entity = existing.get();

        if (entity.getStatus() == CommandStatus.OBSERVED
                || entity.getStatus() == CommandStatus.TIMED_OUT
                || entity.getStatus() == CommandStatus.REJECTED
                || entity.getStatus() == CommandStatus.UNCERTAIN) {
            log.warn("Ignoring late CALL_ERROR for command {} in terminal/observed state {}", entity.getId(), entity.getStatus());
            return;
        }

        if (entity.getStatus() == CommandStatus.ACCEPTED) {
            log.warn("Ignoring late CALL_ERROR for already accepted command {}", entity.getId());
            return;
        }

        entity.setRespondedAt(Instant.now());
        entity.setResponsePayload("{\"error\":\"" + errorCode + "\",\"description\":\"" + errorDescription + "\"}");
        entity.setStatus(CommandStatus.REJECTED);
        repository.save(entity);
    }

    @Transactional
    public void correlateTransactionEvent(
            String stationId,
            String transactionId,
            String eventType,
            Integer remoteStartId,
            Integer evseId
    ) {
        if ("Started".equalsIgnoreCase(eventType)) {
            if (remoteStartId != null && remoteStartId > 0) {
                var candidate = repository.findByStationIdAndActionAndRemoteStartIdAndStatus(
                        stationId,
                        "RequestStartTransaction",
                        remoteStartId,
                        CommandStatus.ACCEPTED
                );
                candidate.ifPresent(entity -> {
                    entity.setStatus(CommandStatus.OBSERVED);
                    entity.setObservedAt(Instant.now());
                    entity.setTransactionId(transactionId);
                    repository.save(entity);
                    log.info("Correlated RequestStartTransaction {} with remoteStartId {} to transactionId {}",
                            entity.getId(), remoteStartId, transactionId);
                });
            } else {
                // If remoteStartId was not included in event, this is an unrelated local or autonomous transaction.
                // It MUST NOT correlate with or overwrite remote start commands.
                log.debug("TransactionEvent Started for station {} has no remoteStartId, skipping command correlation", stationId);
            }
        } else if ("Ended".equalsIgnoreCase(eventType)) {
            if (transactionId != null && !transactionId.isBlank()) {
                var candidate = repository.findByStationIdAndActionAndTransactionIdAndStatus(
                        stationId,
                        "RequestStopTransaction",
                        transactionId,
                        CommandStatus.ACCEPTED
                );
                candidate.ifPresent(entity -> {
                    entity.setStatus(CommandStatus.OBSERVED);
                    entity.setObservedAt(Instant.now());
                    repository.save(entity);
                    log.info("Correlated RequestStopTransaction {} to transactionId {}", entity.getId(), transactionId);
                });
            }
        }
    }

    public void correlateTransactionEvent(
            String stationId,
            String transactionId,
            String eventType
    ) {
        correlateTransactionEvent(stationId, transactionId, eventType, null, null);
    }

    @Transactional
    public void handleStationDisconnect(String stationId) {
        var pending = repository.findByStationIdAndStatus(stationId, CommandStatus.PENDING);
        for (var entity : pending) {
            entity.setStatus(CommandStatus.UNCERTAIN);
            entity.setResponsePayload("{\"status\":\"Uncertain\",\"reason\":\"Station disconnected before response\"}");
            repository.save(entity);
            log.info("Marked pending command {} as UNCERTAIN due to station disconnect", entity.getId());
        }

        var requested = repository.findByStationIdAndStatus(stationId, CommandStatus.REQUESTED);
        for (var entity : requested) {
            entity.setStatus(CommandStatus.REJECTED);
            entity.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected before dispatch\"}");
            repository.save(entity);
        }
    }

    @Transactional
    public void checkTimeouts(String stationId) {
        Instant now = Instant.now();
        var pending = repository.findByStationIdAndStatus(stationId, CommandStatus.PENDING);
        for (var entity : pending) {
            if (entity.getExpiresAt().isBefore(now)) {
                entity.setStatus(CommandStatus.TIMED_OUT);
                repository.save(entity);
            }
        }

        var requested = repository.findByStationIdAndStatus(stationId, CommandStatus.REQUESTED);
        for (var entity : requested) {
            if (entity.getExpiresAt().isBefore(now)) {
                entity.setStatus(CommandStatus.TIMED_OUT);
                repository.save(entity);
            }
        }
    }

    public Optional<StationCommand> getCommand(UUID commandId) {
        return repository.findById(commandId).map(this::toDomain);
    }

    public List<StationCommand> getCommands(
            String organizationId,
            String stationId,
            int page,
            int size
    ) {
        validateStationTenant(organizationId, stationId);
        int boundedSize = Math.max(1, Math.min(size <= 0 ? 50 : size, 100));
        int boundedPage = Math.max(0, page);
        var pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "requestedAt"));
        return repository.findByStationId(stationId, pageable)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    public List<StationCommand> getCommands(String stationId) {
        return getCommands(null, stationId, 0, 50);
    }

    private void validateStationTenant(String organizationId, String stationId) {
        if (organizationId == null || organizationId.isBlank() || chargingStationRepository == null) {
            return;
        }
        var station = chargingStationRepository.findById(stationId);
        if (station.isEmpty() || station.get().getOrganizationId() == null || !station.get().getOrganizationId().equals(organizationId)) {
            throw new TenantAccessDeniedException("Station " + stationId + " does not belong to organization " + organizationId);
        }
    }

    private StationCommand toDomain(StationCommandEntity entity) {
        return new StationCommand(
                entity.getId(),
                entity.getStationId(),
                entity.getMessageId(),
                entity.getAction(),
                entity.getStatus(),
                entity.getIdempotencyKey(),
                entity.getPayload(),
                entity.getResponsePayload(),
                entity.getTransactionId(),
                entity.getRequestedAt(),
                entity.getExpiresAt(),
                entity.getRespondedAt(),
                entity.getObservedAt(),
                entity.getRemoteStartId(),
                entity.getEvseId()
        );
    }
}
