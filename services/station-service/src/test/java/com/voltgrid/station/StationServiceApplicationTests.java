package com.voltgrid.station;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.infrastructure.persistence.jpa.JpaStationReader;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class StationServiceApplicationTests {

    @Autowired
    private StationReader stationReader;

    @Test
    void contextLoads() {
        assertThat(stationReader)
                .isInstanceOf(JpaStationReader.class);
    }
}