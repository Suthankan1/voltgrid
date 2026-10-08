import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getOperationsSnapshot } from '../src/lib/operations-api.ts';
const originalFetch = globalThis.fetch;
const originalEndpoint = process.env.OPERATIONS_GRAPHQL_URL;
afterEach(() => { globalThis.fetch = originalFetch; if (originalEndpoint === undefined) delete process.env.OPERATIONS_GRAPHQL_URL; else process.env.OPERATIONS_GRAPHQL_URL = originalEndpoint; });
test('missing configuration is unavailable', async () => {
 delete process.env.OPERATIONS_GRAPHQL_URL;
 assert.equal((await getOperationsSnapshot()).state, 'unavailable');
});
test('cursor query returns projection and never caches', async () => {
 process.env.OPERATIONS_GRAPHQL_URL = 'http://localhost:8081/graphql';
 globalThis.fetch = async (url, options) => {
  assert.equal(url, process.env.OPERATIONS_GRAPHQL_URL);
  assert.equal(options.cache, 'no-store');
  const body = JSON.parse(options.body);
  assert.deepEqual(body.variables, {after:'cursor',status:null});
  assert.match(body.query, /stationStatuses/);
  return Response.json({data:{stationStatuses:{edges:[{node:{stationId:'CP-1',currentStatus:'UNAVAILABLE',statusChangedAt:'2026-10-08',updatedAt:'2026-10-08'}}],pageInfo:{hasNextPage:true,endCursor:'next'}}}});
 };
 assert.deepEqual(await getOperationsSnapshot('cursor'), {state:'live',stations:[{stationId:'CP-1',currentStatus:'UNAVAILABLE',statusChangedAt:'2026-10-08',updatedAt:'2026-10-08'}],hasNextPage:true,endCursor:'next'});
});
for (const payload of [{errors:[{message:'private internals'}]}, {data:{}}, {data:{stationStatuses:{edges:[],pageInfo:{hasNextPage:true,endCursor:null}}}}]) {
 test('invalid GraphQL payload is unavailable', async () => {
  process.env.OPERATIONS_GRAPHQL_URL = 'http://localhost:8081/graphql';
  globalThis.fetch = async () => Response.json(payload);
  assert.equal((await getOperationsSnapshot()).state, 'unavailable');
 });
}
test('HTTP and network failures are unavailable', async () => {
 process.env.OPERATIONS_GRAPHQL_URL = 'http://localhost:8081/graphql';
 globalThis.fetch = async () => new Response('', {status:503});
 assert.equal((await getOperationsSnapshot()).state, 'unavailable');
 globalThis.fetch = async () => { throw new Error('offline'); };
 assert.equal((await getOperationsSnapshot()).state, 'unavailable');
});

test('status filter is passed as a GraphQL variable', async () => {
 process.env.OPERATIONS_GRAPHQL_URL='http://localhost:8081/graphql';
 globalThis.fetch=async (_url,options)=>{
  assert.deepEqual(JSON.parse(options.body).variables,{after:null,status:'OFFLINE'});
  return Response.json({data:{stationStatuses:{edges:[],pageInfo:{hasNextPage:false,endCursor:null}}}});
 };
 assert.equal((await getOperationsSnapshot(undefined,'OFFLINE')).state,'live');
});
