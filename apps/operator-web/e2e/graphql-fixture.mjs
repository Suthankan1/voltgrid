import { createServer } from 'node:http';
const registered = new Map();
const station = {id:'CP-1',name:'Colombo Central',status:'ONLINE'};
const transaction = {stationId:'CP-1',transactionId:'TX-1',evseId:1,connectorId:1,status:'ENDED',startedAt:'2026-10-08T08:00:00Z',endedAt:'2026-10-08T09:00:00Z',lastSequenceNumber:2};
const completeness = {status:'COMPLETE',firstSequenceNumber:0,lastSequenceNumber:2,missingSequenceNumbers:[]};
createServer(async (req,res) => {
 if(req.url === '/health') {res.end('ok');return;}
 let body='';for await(const chunk of req) body+=chunk;
 const {query,variables={}}=JSON.parse(body);
 let data;
 if(query.includes('OperatorRegister')) {
  const input=variables.input;
  if(registered.has(input.id)) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({errors:[{message:`Station already exists: ${input.id}`}]}));return;}
  const created={...input,status:'OFFLINE'};registered.set(input.id,created);data={registerStation:created};
 } else if(query.includes('OperatorStatuses')) {
  if(variables.after==='failure') {res.writeHead(503);res.end();return;}
  data={stationStatuses:{edges:variables.after ? [] : [{node:{stationId:'CP-1',currentStatus:variables.status ?? 'ONLINE',statusChangedAt:'2026-10-08T08:00:00Z',updatedAt:'2026-10-08T08:00:01Z'}}],pageInfo:{hasNextPage:!variables.after,endCursor:variables.after ? null : 'cursor-2'}}};
 } else if(query.includes('OperatorStations')) data={stations:[station,{id:"CP-2",name:"Kandy Depot",status:"OFFLINE"},...registered.values()]};
 else if(query.includes('OperatorStation(')) data={station:registered.get(variables.id) ?? (['CP-1','CP%1'].includes(variables.id)?{...station,id:variables.id}:null),stationConnectors:[{evseId:1,connectorId:1,status:'AVAILABLE',statusUpdatedAt:'2026-10-08T09:00:00Z'}],stationTransactions:[transaction]};
 else if(query.includes('OperatorNetworkTransactionPage')) data={networkTransactionPage:{content:[{transaction,completeness}],page:variables.page,size:variables.size,totalElements:1,totalPages:1,hasNext:false}};
 else if(query.includes('OperatorTransactionData')) data={transactionCompleteness:completeness,transactionMeterSamples:[]};
 else if(query.includes('OperatorTransaction(')) data={transaction:['TX-1','TX%1'].includes(variables.transactionId)?{...transaction,transactionId:variables.transactionId}:null};
 else {res.writeHead(400);res.end('Unexpected query');return;}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data}));
}).listen(4311,'127.0.0.1');
