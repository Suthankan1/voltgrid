import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e-live',workers:1,timeout:60000,
 use:{baseURL:'http://127.0.0.1:4312',trace:'retain-on-failure'},
 webServer:{command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4312',url:'http://127.0.0.1:4312',reuseExistingServer:false,
  env:{OPERATOR_LOCAL_WRITES:"true",STATION_GRAPHQL_URL:'http://127.0.0.1:18080/graphql',OPERATIONS_GRAPHQL_URL:'http://127.0.0.1:18081/graphql'}},
});
