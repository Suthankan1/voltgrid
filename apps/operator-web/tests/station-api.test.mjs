import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStationSnapshot,
  getStationDetail,
  getStationPageData,
  getNetworkTransactions,
  getNetworkTransactionPage,
  getTransactionInspector,
  getSessionPageData,
} from '../src/lib/station-api.ts';
const originalFetch = globalThis.fetch;
const originalEndpoint = process.env.STATION_GRAPHQL_URL;
afterEach(() => {globalThis.fetch=originalFetch;if(originalEndpoint===undefined) delete process.env.STATION_GRAPHQL_URL;else process.env.STATION_GRAPHQL_URL=originalEndpoint;});
const reads = [
 ['stations',()=>getStationSnapshot()],
 ['station detail',()=>getStationDetail('CP-1')],
 ['network transactions',()=>getNetworkTransactions()],
 ['transaction page',()=>getNetworkTransactionPage(0,20)],
 ['transaction inspector',()=>getTransactionInspector('CP-1','TX-1')],
];
for(const [name,read] of reads) {
 test(`${name}: missing data is unavailable, never empty or not-found`,async()=>{
  process.env.STATION_GRAPHQL_URL='http://localhost:8080/graphql';
  globalThis.fetch=async(_url,options)=>{assert.equal(options.cache,'no-store');assert.ok(options.signal);return Response.json({data:{}});};
  assert.equal((await read()).state,'unavailable');
 });
 test(`${name}: GraphQL internals are not exposed`,async()=>{
  process.env.STATION_GRAPHQL_URL='http://localhost:8080/graphql';
  globalThis.fetch=async()=>Response.json({errors:[{message:'secret database detail'}]});
  const snapshot=await read();assert.equal(snapshot.state,'unavailable');assert.doesNotMatch(snapshot.message,/secret/);
 });
}
test('explicit null transaction means not-found',async()=>{
 process.env.STATION_GRAPHQL_URL='http://localhost:8080/graphql';
 globalThis.fetch=async()=>Response.json({data:{transaction:null}});
 assert.equal((await getTransactionInspector('CP-1','missing')).state,'not-found');
});
test('successful empty list remains live',async()=>{
 process.env.STATION_GRAPHQL_URL='http://localhost:8080/graphql';
 globalThis.fetch=async()=>Response.json({data:{stations:[]}});
 assert.deepEqual(await getStationSnapshot(),{state:'live',stations:[]});
});

for (const [name,read,data] of [
 ['station list',()=>getStationSnapshot(),{stations:[null]}],
 ['station detail',()=>getStationDetail('CP-1'),{station:{id:'CP-1'},stationConnectors:[],stationTransactions:[]}],
 ['network transactions',()=>getNetworkTransactions(),{networkTransactions:[{transaction:null,completeness:null}]}],
 ['transaction page',()=>getNetworkTransactionPage(0,20),{networkTransactionPage:{content:[null],page:0,size:20,totalElements:1,totalPages:1,hasNext:false}}],
 ['transaction lookup',()=>getTransactionInspector('CP-1','TX-1'),{transaction:{transactionId:'TX-1'}}],
]) {
 test(`${name}: malformed nested rows are unavailable`,async()=>{
  process.env.STATION_GRAPHQL_URL='http://localhost:8080/graphql';
  globalThis.fetch=async()=>Response.json({data});
  assert.equal((await read()).state,'unavailable');
 });
}

test('getStationPageData distinguishes explicit null not-found from error and supports independent partial failures', async () => {
 process.env.STATION_GRAPHQL_URL = 'http://localhost:8080/graphql';

 globalThis.fetch = async () => Response.json({ data: { station: null, stationConnectors: [], stationTransactions: [] } });
 assert.deepEqual(await getStationPageData('missing'), { state: 'not-found' });

 globalThis.fetch = async () => Response.json({
  data: { station: null, stationConnectors: [], stationTransactions: [] },
  errors: [{ message: 'secret lookup error' }],
 });
 assert.equal((await getStationPageData('CP-1')).state, 'unavailable');

 globalThis.fetch = async () => Response.json({
  data: {
   station: { id: 'CP-1', name: 'Colombo Central', status: 'ONLINE' },
   stationConnectors: null,
   stationTransactions: [{
    stationId: 'CP-1',
    transactionId: 'TX-1',
    evseId: 1,
    connectorId: 1,
    status: 'ACTIVE',
    startedAt: '2026-10-08T08:00:00Z',
    endedAt: null,
    lastSequenceNumber: 2,
   }],
  },
  errors: [{ message: 'connector failure', path: ['stationConnectors'] }],
 });
 const partialConnectorFail = await getStationPageData('CP-1');
 assert.equal(partialConnectorFail.state, 'live');
 assert.equal(partialConnectorFail.station.name, 'Colombo Central');
 assert.equal(partialConnectorFail.connectors.state, 'unavailable');
 assert.equal(partialConnectorFail.transactions.state, 'live');
 assert.equal(partialConnectorFail.transactions.items.length, 1);

 globalThis.fetch = async () => Response.json({
  data: {
   station: { id: 'CP-1', name: 'Colombo Central', status: 'ONLINE' },
   stationConnectors: [{ evseId: 1, connectorId: 1, status: 'AVAILABLE', statusUpdatedAt: '2026-10-08T09:00:00Z' }],
   stationTransactions: null,
  },
  errors: [{ message: 'session failure', path: ['stationTransactions'] }],
 });
 const partialTxFail = await getStationPageData('CP-1');
 assert.equal(partialTxFail.state, 'live');
 assert.equal(partialTxFail.connectors.state, 'live');
 assert.equal(partialTxFail.connectors.items.length, 1);
 assert.equal(partialTxFail.transactions.state, 'unavailable');
});

test('getSessionPageData preserves not-found vs error distinction and partial operational failures', async () => {
 process.env.STATION_GRAPHQL_URL = 'http://localhost:8080/graphql';

 globalThis.fetch = async () => Response.json({ data: { transaction: null } });
 assert.deepEqual(await getSessionPageData('CP-1', 'missing'), { state: 'not-found' });

 globalThis.fetch = async () => Response.json({
  data: { transaction: null },
  errors: [{ message: 'secret db error', path: ['transaction'] }],
 });
 const erroredLookup = await getSessionPageData('CP-1', 'TX-1');
 assert.equal(erroredLookup.state, 'unavailable');
 assert.doesNotMatch(erroredLookup.message, /secret/);

 const validTx = {
  stationId: 'CP-1',
  transactionId: 'TX-1',
  evseId: 1,
  connectorId: 1,
  status: 'ENDED',
  startedAt: '2026-10-08T08:00:00Z',
  endedAt: '2026-10-08T09:00:00Z',
  lastSequenceNumber: 2,
 };
 const validComp = {
  status: 'COMPLETE',
  firstSequenceNumber: 0,
  lastSequenceNumber: 2,
  missingSequenceNumbers: [],
 };
 const validSample = {
  sequenceNumber: 1,
  sampledAt: '2026-10-08T08:15:00Z',
  value: '7400',
  measurand: 'Power.Active.Import',
  context: 'Sample.Periodic',
  phase: null,
  location: 'Outlet',
  unit: 'W',
  unitMultiplier: 0,
 };

 let callCount = 0;
 globalThis.fetch = async () => {
  callCount += 1;
  if (callCount === 1) {
   return Response.json({ data: { transaction: validTx } });
  }
  return Response.json({
   data: {
    transactionCompleteness: null,
    transactionMeterSamples: [validSample],
   },
   errors: [{ message: 'secret completeness crash', path: ['transactionCompleteness'] }],
  });
 };
 const compFail = await getSessionPageData('CP-1', 'TX-1');
 assert.equal(compFail.state, 'live');
 assert.equal(compFail.transaction.transactionId, 'TX-1');
 assert.equal(compFail.completeness.state, 'unavailable');
 assert.doesNotMatch(compFail.completeness.message, /secret/);
 assert.equal(compFail.meterSamples.state, 'live');
 assert.equal(compFail.meterSamples.samples.length, 1);

 callCount = 0;
 globalThis.fetch = async () => {
  callCount += 1;
  if (callCount === 1) {
   return Response.json({ data: { transaction: validTx } });
  }
  return Response.json({
   data: {
    transactionCompleteness: validComp,
    transactionMeterSamples: null,
   },
   errors: [{ message: 'secret sample crash', path: ['transactionMeterSamples'] }],
  });
 };
 const sampleFail = await getSessionPageData('CP-1', 'TX-1');
 assert.equal(sampleFail.state, 'live');
 assert.equal(sampleFail.completeness.state, 'live');
 assert.equal(sampleFail.completeness.completeness.status, 'COMPLETE');
 assert.equal(sampleFail.meterSamples.state, 'unavailable');
 assert.doesNotMatch(sampleFail.meterSamples.message, /secret/);

 callCount = 0;
 globalThis.fetch = async () => {
  callCount += 1;
  if (callCount === 1) {
   return Response.json({ data: { transaction: validTx } });
  }
  return new Response('bad gateway', { status: 502 });
 };
 const step2HttpFail = await getSessionPageData('CP-1', 'TX-1');
 assert.equal(step2HttpFail.state, 'live');
 assert.equal(step2HttpFail.transaction.transactionId, 'TX-1');
 assert.equal(step2HttpFail.completeness.state, 'unavailable');
 assert.equal(step2HttpFail.meterSamples.state, 'unavailable');

 callCount = 0;
 globalThis.fetch = async () => {
  callCount += 1;
  if (callCount === 1) {
   return Response.json({ data: { transaction: validTx } });
  }
  return Response.json({
   data: {
    transactionCompleteness: validComp,
    transactionMeterSamples: [{ ...validSample, value: 7400 }],
   },
  });
 };
 const malformedSample = await getSessionPageData('CP-1', 'TX-1');
 assert.equal(malformedSample.state, 'live');
 assert.equal(malformedSample.completeness.state, 'live');
 assert.equal(malformedSample.meterSamples.state, 'unavailable');
});

test('getStationPageData fails closed for sections when GraphQL returns an unpathed error alongside empty arrays', async () => {
 process.env.STATION_GRAPHQL_URL = 'http://localhost:8080/graphql';
 globalThis.fetch = async () => Response.json({
  data: {
   station: { id: 'CP-1', name: 'Colombo Central', status: 'ONLINE' },
   stationConnectors: [],
   stationTransactions: [],
  },
  errors: [{ message: 'internal resolver aborted' }],
 });

 const result = await getStationPageData('CP-1');
 assert.equal(result.state, 'live');
 assert.equal(result.connectors.state, 'unavailable');
 assert.equal(result.transactions.state, 'unavailable');
 assert.doesNotMatch(result.connectors.message, /aborted/);
 assert.doesNotMatch(result.transactions.message, /aborted/);
});
