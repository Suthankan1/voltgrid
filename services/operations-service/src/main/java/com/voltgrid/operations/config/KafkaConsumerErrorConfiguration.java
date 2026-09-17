package com.voltgrid.operations.config;

import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration(proxyBeanMethods = false)
public class KafkaConsumerErrorConfiguration {

    @Bean
    CommonErrorHandler kafkaCommonErrorHandler(
            KafkaTemplate<String, String> kafkaTemplate,
            @Value(
                    "${voltgrid.kafka.station-status-dlt-topic}"
            )
            String deadLetterTopic,
            @Value(
                    "${voltgrid.kafka.consumer.retry-backoff-ms}"
            )
            long retryBackoffMs,
            @Value(
                    "${voltgrid.kafka.consumer.max-retries}"
            )
            long maxRetries
    ) {
        var recoverer =
                new DeadLetterPublishingRecoverer(
                        kafkaTemplate,
                        (record, exception) ->
                                new TopicPartition(
                                        deadLetterTopic,
                                        -1
                                )
                );

        recoverer.setFailIfSendResultIsError(
                true
        );

        var errorHandler =
                new DefaultErrorHandler(
                        recoverer,
                        new FixedBackOff(
                                retryBackoffMs,
                                maxRetries
                        )
                );

        errorHandler.addNotRetryableExceptions(
                IllegalArgumentException.class
        );

        return errorHandler;
    }
}