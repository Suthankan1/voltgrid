package com.voltgrid.operations.messaging.consumer;

import com.voltgrid.operations.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.ContainerProperties;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = {
                "spring.kafka.listener.auto-startup=false"
        }
)
@Import(PostgresTestConfiguration.class)
class StationStatusConsumerConfigurationIntegrationTests {

    @Autowired
    private KafkaListenerEndpointRegistry registry;

    @Test
    void shouldUseRecordAcknowledgmentMode() {
        var containers =
                registry.getListenerContainers();

        assertThat(
                containers
        ).hasSize(
                1
        );

        var container =
                containers
                        .iterator()
                        .next();

        assertThat(
                container
                        .getContainerProperties()
                        .getAckMode()
        ).isEqualTo(
                ContainerProperties.AckMode.RECORD
        );
    }
}