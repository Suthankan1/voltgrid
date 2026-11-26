import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './e2e', fullyParallel: false, workers: 1,
 use: {baseURL:'http://127.0.0.1:4310',trace:'retain-on-failure'},
 projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', testMatch: /\/(operator|shell|cross-browser)\.spec\.ts$/, use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', testMatch: /\/(operator|shell|cross-browser)\.spec\.ts$/, use: { ...devices['Desktop Safari'] } },
 ],
 webServer: [
  {command:'node e2e/graphql-fixture.mjs',url:'http://127.0.0.1:4311/health',reuseExistingServer:false},
  {command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4310',url:'http://127.0.0.1:4310',reuseExistingServer:false,
   env:{OPERATOR_LOCAL_WRITES:"true",STATION_GRAPHQL_URL:'http://127.0.0.1:4311/graphql',OPERATIONS_GRAPHQL_URL:'http://127.0.0.1:4311/graphql'}},
 ],
});
