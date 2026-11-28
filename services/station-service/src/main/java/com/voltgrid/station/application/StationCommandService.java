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
import org.springframework.transaction.TransactionDefinition;
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
    private final TransactionTemplate dispatchResultTransaction;
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
        this.dispatchResultTransaction = new TransactionTemplate(transactionManager);
        this.dispatchResultTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
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
        if (evseId > 0) {
            wireNode.put("evseId", evseId);
        }
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

            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatchCommittedCommand(saved, wirePayloadJson);
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

        return toDomain(dispatchCommittedCommand(committedEntity, wirePayloadJson));
    }

    public StationCommand requestStopTransaction(
            String stationId,
            String transactionId,
            String idempotencyKey
    ) {
        if (!isValidTransactionId(transactionId)) {
            throw new IllegalArgumentException("transactionId must contain 1 to 36 characters");
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

            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatchCommittedCommand(saved, payloadJson);
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

        return toDomain(dispatchCommittedCommand(committedEntity, payloadJson));
    }

    private StationCommandEntity dispatchCommittedCommand(StationCommandEntity command, String wirePayload) {
        boolean sent = commandSender != null && commandSender.sendCall(
                command.getStationId(), command.getMessageId(), command.getAction(), wirePayload);
        return dispatchResultTransaction.execute(status -> {
            repository.updateDispatchResult(command.getId(), CommandStatus.REQUESTED,
                    sent ? CommandStatus.PENDING : CommandStatus.REJECTED,
                    sent ? null : "{\"status\":\"Rejected\",\"reason\":\"Station disconnected or send failed\"}");
            return repository.findById(command.getId()).orElseThrow();
        });
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
                var transactionId = node.get("transactionId");
                if ("RequestStartTransaction".equals(entity.getAction()) && transactionId != null
                        && transactionId.isTextual() && isValidTransactionId(transactionId.asText())) {
                    entity.setTransactionId(transactionId.asText());
                }
            }
        } catch (Exception ex) {
            log.warn("Invalid CALL_RESULT for command {}", entity.getId());
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
        var errorPayload = jsonMapper.createObjectNode();
        errorPayload.put("error", errorCode);
        entity.setResponsePayload(jsonMapper.writeValueAsString(errorPayload));
        entity.setStatus(CommandStatus.REJECTED);
        repository.save(entity);
    }

    @Transactional
    public void correlateTransactionEvent(
            String stationId,
            String transactionId,
            String eventType,
            String triggerReason,
            Integer remoteStartId,
            Integer evseId
    ) {
        if (!isValidTransactionId(transactionId)) {
            return;
        }

        boolean startObservation = "Started".equals(eventType)
                || ("Updated".equals(eventType) && "RemoteStart".equals(triggerReason));
        if (startObservation && remoteStartId != null && remoteStartId > 0
                && evseId != null && evseId > 0) {
            var candidates = repository.findFirst2ByStationIdAndActionAndRemoteStartIdOrderById(
                    stationId, "RequestStartTransaction", remoteStartId);
            if (candidates.size() == 1) {
                var command = candidates.getFirst();
                Integer expectedEvse = command.getEvseId();
                if (expectedEvse != null && (expectedEvse == 0 || expectedEvse.equals(evseId))
                        && (command.getTransactionId() == null || command.getTransactionId().equals(transactionId))) {
                    observe(command, transactionId);
                }
            }
        } else if (("Ended".equals(eventType) || "Updated".equals(eventType))
                && "RemoteStop".equals(triggerReason)) {
            var candidates = repository.findFirst2ByStationIdAndActionAndTransactionIdOrderById(
                    stationId, "RequestStopTransaction", transactionId);
            if (candidates.size() == 1) {
                observe(candidates.getFirst(), transactionId);
            }
        }
    }

    private void observe(StationCommandEntity command, String transactionId) {
        switch (command.getStatus()) {
            case REQUESTED, PENDING, ACCEPTED, TIMED_OUT, UNCERTAIN -> {
                command.setStatus(CommandStatus.OBSERVED);
                command.setObservedAt(Instant.now());
                command.setTransactionId(transactionId);
            }
            case REJECTED, OBSERVED -> { }
        }
    }

    @Transactional
    public void handleStationDisconnect(String stationId) {
        repository.updateDisconnectedCommands(stationId, CommandStatus.PENDING, CommandStatus.UNCERTAIN,
                "{\"status\":\"Uncertain\",\"reason\":\"Station disconnected before response\"}");
        repository.updateDisconnectedCommands(stationId, CommandStatus.REQUESTED, CommandStatus.UNCERTAIN,
                "{\"status\":\"Uncertain\",\"reason\":\"Station disconnected during dispatch\"}");
    }

    @Transactional
    public void checkTimeouts(String stationId) {
        repository.updateExpiredCommands(stationId, List.of(CommandStatus.REQUESTED, CommandStatus.PENDING),
                CommandStatus.TIMED_OUT, Instant.now());
    }

    private static boolean isValidTransactionId(String transactionId) {
        return transactionId != null && !transactionId.isBlank() && transactionId.length() <= 36;
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
