import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {localRegistrationEnabled,registerStation} from '../src/lib/station-registration.ts';
const originalFetch=globalThis.fetch;
const originalWrites=process.env.OPERATOR_LOCAL_WRITES;
const originalEndpoint=process.env.STATION_GRAPHQL_URL;
afterEach(()=>{globalThis.fetch=originalFetch;for(const [key,value] of [['OPERATOR_LOCAL_WRITES',originalWrites],['STATION_GRAPHQL_URL',originalEndpoint]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
function enable(){process.env.OPERATOR_LOCAL_WRITES='true';process.env.STATION_GRAPHQL_URL='http://127.0.0.1:8080/graphql';}
test('writes require explicit opt-in and a local HTTP backend',async()=>{
 globalThis.fetch=()=>{throw new Error('Must not fetch');};
 delete process.env.OPERATOR_LOCAL_WRITES;
 assert.equal(localRegistrationEnabled(),false);
 assert.match((await registerStation('CP-1','Station')).message,/disabled/);
 process.env.OPERATOR_LOCAL_WRITES='true';process.env.STATION_GRAPHQL_URL='https://production.example/graphql';
 assert.equal(localRegistrationEnabled(),false);
 assert.match((await registerStation('CP-1','Station')).message,/disabled/);
});
for(const [id,name] of [['','Station'],['../unsafe','Station'],['x'.repeat(256),'Station'],['CP-1',''],['CP-1','x'.repeat(256)]]){
 test(`invalid registration ${id.slice(0,10)} / ${name.slice(0,10)} does not mutate`,async()=>{
  enable();globalThis.fetch=()=>{throw new Error('Must not fetch');};
  assert.ok((await registerStation(id,name)).message);
 });
}
test('registration validates and trims before sending GraphQL variables',async()=>{
 enable();globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);assert.deepEqual(body.variables,{input:{id:'CP-1',name:'Station'}});
  assert.equal(options.cache,'no-store');assert.ok(options.signal);
  return Response.json({data:{registerStation:{id:'CP-1',name:'Station',status:'OFFLINE'}}});
 };
 assert.deepEqual(await registerStation(' CP-1 ',' Station '),{stationId:'CP-1'});
});
test('duplicate errors are actionable without revealing arbitrary backend errors',async()=>{
 enable();globalThis.fetch=async()=>Response.json({errors:[{message:'Station already exists: CP-1'}]});
 assert.match((await registerStation('CP-1','Station')).message,/already registered/);
 globalThis.fetch=async()=>Response.json({errors:[{message:'secret connection string'}]});
 assert.doesNotMatch((await registerStation('CP-1','Station')).message,/secret/);
});
test('ambiguous network outcome tells operator to inspect fleet before retrying',async()=>{
 enable();globalThis.fetch=async()=>{throw new Error('connection lost');};
 assert.match((await registerStation('CP-1','Station')).message,/before retrying/);
});
