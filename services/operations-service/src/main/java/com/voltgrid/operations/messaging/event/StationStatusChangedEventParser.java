package com.voltgrid.operations.messaging.event;

import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Component
public class StationStatusChangedEventParser {

    private final JsonMapper jsonMapper;

    public StationStatusChangedEventParser(
            JsonMapper jsonMapper
    ) {
        this.jsonMapper =
                jsonMapper;
    }

    public StationStatusChangedEvent parse(
            String payload
    ) {
        if (payload == null || payload.isBlank()) {
            throw new IllegalArgumentException(
                    "payload must not be blank"
            );
        }

        try {
            return jsonMapper.readValue(
                    payload,
                    StationStatusChangedEvent.class
            );

        } catch (JacksonException exception) {
            throw new IllegalArgumentException(
                    "Invalid StationStatusChanged event payload",
                    exception
            );
        }
    }
}