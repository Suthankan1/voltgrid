package com.voltgrid.station.application;

import com.voltgrid.station.domain.CommandStatus;
import com.voltgrid.station.domain.StationCommand;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCommandEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCommandJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class StationCommandService {

    private static final Logger log = LoggerFactory.getLogger(StationCommandService.class);
    private static final Duration DEFAULT_COMMAND_TIMEOUT = Duration.ofSeconds(30);

    private final StationCommandJpaRepository repository;
    private final JsonMapper jsonMapper;
    private OcppCommandSender commandSender;

    @Autowired
    public StationCommandService(
            StationCommandJpaRepository repository,
            JsonMapper jsonMapper
    ) {
        this.repository = repository;
        this.jsonMapper = jsonMapper;
    }

    @Autowired(required = false)
    public void setCommandSender(@org.springframework.context.annotation.Lazy OcppCommandSender commandSender) {
        this.commandSender = commandSender;
    }

    @Transactional
    public StationCommand requestStartTransaction(
            String stationId,
            int evseId,
            String idToken,
            String remoteStartId,
            String idempotencyKey
    ) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
            if (existing.isPresent()) {
                return toDomain(existing.get());
            }
        }

        UUID commandId = UUID.randomUUID();
        String messageId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(DEFAULT_COMMAND_TIMEOUT);

        var payloadNode = jsonMapper.createObjectNode();
        payloadNode.put("evseId", evseId);
        if (remoteStartId != null && !remoteStartId.isBlank()) {
            try {
                payloadNode.put("remoteStartId", Integer.parseInt(remoteStartId));
            } catch (NumberFormatException e) {
                payloadNode.put("remoteStartId", 1);
            }
        }
        var idTokenNode = payloadNode.putObject("idToken");
        idTokenNode.put("idToken", idToken);
        idTokenNode.put("type", "ISO14443");

        String payloadJson = jsonMapper.writeValueAsString(payloadNode);

        var entity = new StationCommandEntity(
                commandId,
                stationId,
                messageId,
                "RequestStartTransaction",
                CommandStatus.REQUESTED,
                idempotencyKey,
                payloadJson,
                now,
                expiresAt
        );

        entity = repository.save(entity);

        if (commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStartTransaction", payloadJson)) {
            entity.setStatus(CommandStatus.PENDING);
        } else {
            entity.setStatus(CommandStatus.REJECTED);
            entity.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected\"}");
        }

        entity = repository.save(entity);
        return toDomain(entity);
    }

    @Transactional
    public StationCommand requestStopTransaction(
            String stationId,
            String transactionId,
            String idempotencyKey
    ) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = repository.findByStationIdAndIdempotencyKey(stationId, idempotencyKey);
            if (existing.isPresent()) {
                return toDomain(existing.get());
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
        entity = repository.save(entity);

        if (commandSender != null && commandSender.sendCall(stationId, messageId, "RequestStopTransaction", payloadJson)) {
            entity.setStatus(CommandStatus.PENDING);
        } else {
            entity.setStatus(CommandStatus.REJECTED);
            entity.setResponsePayload("{\"status\":\"Rejected\",\"reason\":\"Station disconnected\"}");
        }

        entity = repository.save(entity);
        return toDomain(entity);
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

        if (isAccepted) {
            entity.setStatus(CommandStatus.ACCEPTED);
        } else {
            entity.setStatus(CommandStatus.REJECTED);
        }

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
        entity.setRespondedAt(Instant.now());
        entity.setResponsePayload("{\"error\":\"" + errorCode + "\",\"description\":\"" + errorDescription + "\"}");
        entity.setStatus(CommandStatus.REJECTED);
        repository.save(entity);
    }

    @Transactional
    public void correlateTransactionEvent(
            String stationId,
            String transactionId,
            String eventType
    ) {
        if ("Started".equalsIgnoreCase(eventType)) {
            var candidate = repository.findTopByStationIdAndActionAndStatusOrderByRequestedAtDesc(
                    stationId,
                    "RequestStartTransaction",
                    CommandStatus.ACCEPTED
            );
            candidate.ifPresent(entity -> {
                entity.setStatus(CommandStatus.OBSERVED);
                entity.setObservedAt(Instant.now());
                entity.setTransactionId(transactionId);
                repository.save(entity);
            });
        } else if ("Ended".equalsIgnoreCase(eventType)) {
            var candidate = repository.findTopByStationIdAndActionAndStatusOrderByRequestedAtDesc(
                    stationId,
                    "RequestStopTransaction",
                    CommandStatus.ACCEPTED
            );
            candidate.ifPresent(entity -> {
                entity.setStatus(CommandStatus.OBSERVED);
                entity.setObservedAt(Instant.now());
                repository.save(entity);
            });
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
    }

    public List<StationCommand> getCommands(String stationId) {
        return repository.findByStationIdOrderByRequestedAtDesc(stationId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    public Optional<StationCommand> getCommand(UUID commandId) {
        return repository.findById(commandId).map(this::toDomain);
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
                entity.getObservedAt()
        );
    }
}
