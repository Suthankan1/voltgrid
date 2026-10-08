import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getStationSnapshot, getStationDetail, getNetworkTransactions, getNetworkTransactionPage, getTransactionInspector } from '../src/lib/station-api.ts';
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
