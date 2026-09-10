package com.voltgrid.station;

import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.grpc.client.ImportGrpcClients;

@SpringBootApplication
@ImportGrpcClients(
        target = "authorization",
        types = AuthorizationServiceGrpc.AuthorizationServiceBlockingStub.class
)
public class StationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(
                StationServiceApplication.class,
                args
        );
    }
}