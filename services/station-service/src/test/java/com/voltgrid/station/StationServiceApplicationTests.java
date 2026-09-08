package com.voltgrid.station;

import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class StationServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}