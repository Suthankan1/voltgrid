import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('real OCPP, authorization, Kafka projection and operator transaction journey', async ({ page, request }) => {
 for (const port of [18080,18081]) {
  await expect.poll(async()=>{
   try { return (await request.get(`http://127.0.0.1:${port}/actuator/health/readiness`,{timeout:2000})).ok(); }
   catch { return false; }
  },{timeout:30000}).toBeTruthy();
 }
 const stationId = `OPERATOR-${randomUUID()}`;
 const transactionId = `TX-${randomUUID()}`;
 const registration = await request.post('http://127.0.0.1:18080/graphql', {
  data:{query:'mutation Register($id: ID!) { registerStation(input: { id: $id, name: "Operator E2E Station" }) { id } }',variables:{id:stationId}},
 });
 expect(registration.ok()).toBeTruthy();
 expect((await registration.json()).errors).toBeUndefined();
 const socket = new WebSocket(`ws://127.0.0.1:18080/ocpp/${stationId}`, 'ocpp2.0.1');
 try {
  await new Promise<void>((resolve,reject) => {
   const timer=setTimeout(()=>reject(new Error('OCPP connection timeout')),5000);
   socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('OCPP connection failed'));},{once:true});
  });
  async function call(action:string,payload:object) {
   const id=randomUUID();
   return await new Promise<Record<string, unknown>>((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.removeEventListener('message',onMessage);reject(new Error(`${action} timeout`));},5000);
    function onMessage(event:MessageEvent) {
     const message=JSON.parse(String(event.data));
     if(message[1]!==id) return;
     clearTimeout(timer);socket.removeEventListener('message',onMessage);
     if(message[0]!==3) reject(new Error(JSON.stringify(message))); else resolve(message[2]);
    }
    socket.addEventListener('message',onMessage);
    socket.send(JSON.stringify([2,id,action,payload]));
   });
  }
  expect((await call('BootNotification',{reason:'PowerUp',chargingStation:{model:'Operator Test',vendorName:'VoltGrid'}})).status).toBe('Accepted');
  expect((await call('Authorize',{idToken:{idToken:'UNREGISTERED-E2E',type:'ISO14443'}})).idTokenInfo).toEqual(expect.objectContaining({status:'Invalid'}));
  await expect.poll(async()=>{
   const response=await request.post('http://127.0.0.1:18081/graphql',{data:{query:'query Status($id: ID!) { stationStatus(stationId:$id) { currentStatus } }',variables:{id:stationId}}});
   return (await response.json()).data?.stationStatus?.currentStatus;
  },{timeout:30000}).toBe('ONLINE');
  await call('StatusNotification',{timestamp:new Date().toISOString(),connectorStatus:'Available',evseId:1,connectorId:1});
  await call('TransactionEvent',{eventType:'Started',timestamp:new Date().toISOString(),triggerReason:'CablePluggedIn',seqNo:0,transactionInfo:{transactionId,chargingState:'EVConnected'},evse:{id:1,connectorId:1}});
  await call('TransactionEvent',{eventType:'Ended',timestamp:new Date().toISOString(),triggerReason:'StopAuthorized',seqNo:1,transactionInfo:{transactionId}});
  await page.goto('/');
  await page.getByRole('link',{name:'Operator E2E Station →',exact:true}).and(page.locator(`a[href="/stations/${stationId}"]`)).click();
  await expect(page.getByRole('heading',{name:'Operator E2E Station'})).toBeVisible();
  await page.goto(`/stations/${stationId}/transactions/${transactionId}`);
  await expect(page.getByRole('heading',{name:transactionId,exact:true})).toBeVisible();
  await expect(page.getByText('Complete',{exact:true}).first()).toBeVisible();
  await page.goto(`/transactions?stationId=${stationId}`);
  await expect(page.getByText(transactionId,{exact:true}).first()).toBeVisible();
  await page.goto('/operations');
  const row=page.getByRole('row').filter({hasText:stationId});
  await expect(row).toContainText('ONLINE');
  await row.getByRole('link',{name:stationId,exact:true}).click();
  await expect(page.getByRole('heading',{name:'Operator E2E Station'})).toBeVisible();
 } finally { socket.close(); }
});
