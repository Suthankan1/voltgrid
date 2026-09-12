package com.voltgrid.authorization;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest(
        properties = "spring.grpc.server.port=0"
)
@Import(PostgresTestConfiguration.class)
class AuthorizationServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}