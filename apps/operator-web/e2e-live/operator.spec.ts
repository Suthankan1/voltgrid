import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { signIn } from '../e2e/sign-in';

const NodeWebSocket = WebSocket as unknown as new (
  url: string, options: { protocols: string[]; headers?: Record<string, string> }
) => WebSocket;

async function connectStation(stationId: string, password?: string) {
 const headers = password ? { Authorization: `Basic ${Buffer.from(`${stationId}:${password}`).toString('base64')}` } : undefined;
 const socket = new NodeWebSocket(`ws://127.0.0.1:18080/ocpp/${stationId}`, { protocols: ['ocpp2.0.1'], headers });
 await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => { socket.close(); reject(new Error('OCPP connection timeout')); }, 5000);
  socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
  socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('OCPP connection rejected')); }, { once: true });
 });
 return socket;
}


test('real OCPP, authorization, Kafka projection and operator transaction journey', async ({ page, request, browser }) => {
 test.setTimeout(120_000);
 const origin = 'http://127.0.0.1:4312';
 for (const port of [18080,18081]) {
  await expect.poll(async()=>{
   try { return (await request.get(`http://127.0.0.1:${port}/actuator/health/readiness`,{timeout:2000})).ok(); }
   catch { return false; }
  },{timeout:30000}).toBeTruthy();
 }
 await page.goto('/');
 await expect(page).toHaveURL(/\/login$/);
 await signIn(page, origin);
 const stationId = `OPERATOR-${randomUUID()}`;
 const transactionId = `TX-${randomUUID()}`;
 await page.goto('/stations/new');
 await page.getByLabel('Station identifier',{exact:true}).fill(stationId);
 await page.getByLabel('Station name',{exact:true}).fill('Operator E2E Station');
 await page.getByRole('button',{name:'Register station',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Station registered'})).toBeVisible();
 await expect(page.getByText(`/ocpp/${stationId}`)).toBeVisible();
 await page.getByRole('link',{name:'Inspect station details'}).click();
 await expect(page).toHaveURL(new RegExp(`/stations/${stationId}$`));
 await expect(connectStation(stationId)).rejects.toThrow('OCPP connection rejected');

 const password = randomBytes(32).toString('hex');
 await page.goto('/admin/credentials');
 await page.getByPlaceholder('STATION-001', { exact: true }).fill(stationId);
 await page.locator('input[name="password"]').fill(password);
 await page.getByRole('button', { name: 'Provision Credential', exact: true }).click();
 await expect.poll(async () => {
  try {
   const probe = await connectStation(stationId, password);
   probe.close();
   return true;
  } catch {
   return false;
  }
 }).toBe(true);

 const socket = await connectStation(stationId, password);
 try {
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
  expect((await call('Heartbeat', {})).currentTime).toBeTruthy();
  expect((await call('Authorize',{idToken:{idToken:'UNREGISTERED-E2E',type:'ISO14443'}})).idTokenInfo).toEqual(expect.objectContaining({status:'Invalid'}));
  if (process.env.VG_TEST_RFID_TOKEN) {
   const result = await call('Authorize', { idToken: { idToken: process.env.VG_TEST_RFID_TOKEN, type: 'ISO14443' } });
   expect(result.idTokenInfo).toEqual(expect.objectContaining({ status: 'Accepted' }));
  }
  await call('StatusNotification',{timestamp:new Date().toISOString(),connectorStatus:'Available',evseId:1,connectorId:1});
  await call('StatusNotification',{timestamp:new Date().toISOString(),connectorStatus:'Faulted',evseId:1,connectorId:2});
  const startedAt = new Date().toISOString();
  const sampleOneAt = new Date(Date.now() + 1000).toISOString();
  const sampleTwoAt = new Date(Date.now() + 2000).toISOString();
  const endedAt = new Date(Date.now() + 3000).toISOString();
  await call('TransactionEvent',{eventType:'Started',timestamp:startedAt,triggerReason:'CablePluggedIn',seqNo:0,transactionInfo:{transactionId,chargingState:'EVConnected'},evse:{id:1,connectorId:1}});
  await call('TransactionEvent',{
   eventType:'Updated',
   timestamp:sampleOneAt,
   triggerReason:'MeterValuePeriodic',
   seqNo:1,
   transactionInfo:{transactionId,chargingState:'Charging'},
   meterValue:[
    {
     timestamp:sampleOneAt,
     sampledValue:[
      {value:7.4,measurand:'Power.Active.Import',context:'Sample.Periodic',location:'Outlet',unitOfMeasure:{unit:'W',multiplier:3}},
      {value:12.5,measurand:'Energy.Active.Import.Register',context:'Sample.Periodic',location:'Outlet',unitOfMeasure:{unit:'Wh',multiplier:3}},
     ],
    },
    {
     timestamp:sampleTwoAt,
     sampledValue:[
      {value:8.2,measurand:'Power.Active.Import',context:'Sample.Periodic',location:'Outlet',unitOfMeasure:{unit:'W',multiplier:3}},
     ],
    },
   ],
  });
  await call('TransactionEvent',{eventType:'Ended',timestamp:endedAt,triggerReason:'StopAuthorized',seqNo:2,transactionInfo:{transactionId}});

  const incompleteTxId = `TX-GAP-${randomUUID()}`;
  const gapStartedAt = new Date(Date.now() + 4000).toISOString();
  const gapEndedAt = new Date(Date.now() + 5000).toISOString();
  await call('TransactionEvent',{eventType:'Started',timestamp:gapStartedAt,triggerReason:'CablePluggedIn',seqNo:0,transactionInfo:{transactionId:incompleteTxId,chargingState:'EVConnected'},evse:{id:1,connectorId:1}});
  await call('TransactionEvent',{eventType:'Ended',timestamp:gapEndedAt,triggerReason:'StopAuthorized',seqNo:2,transactionInfo:{transactionId:incompleteTxId}});
  await page.goto('/');
  await page.getByRole('link',{name:'Operator E2E Station',exact:true}).and(page.locator(`a[href="/stations/${stationId}"]`)).click();
  await expect(page.getByRole('heading',{name:'Operator E2E Station'})).toBeVisible();
  await page.getByRole('navigation',{name:'Station sections'}).getByRole('link',{name:/Connectors/}).click();
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}\\?section=connectors$`));
  await expect(page.getByText('EVSE 1 · Connector 1')).toBeVisible();
  await expect(page.getByText('EVSE 1 · Connector 2')).toBeVisible();
  await expect(page.getByText('Faulted',{exact:true}).first()).toBeVisible();
  await page.goto(`/stations/${stationId}/transactions/${transactionId}`);
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}/sessions/${transactionId}$`));
  await expect(page.getByRole('heading',{name:`Session ${transactionId}`,exact:true})).toBeVisible();
  await expect(page.getByText('Complete',{exact:true}).first()).toBeVisible();
  await page.getByRole('navigation',{name:'Session sections'}).getByRole('link',{name:/Measurements/}).click();
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}/sessions/${transactionId}\\?section=measurements$`));
  await expect(page.getByRole('img',{name:/Time-series measurement chart/i})).toBeVisible();
  const streamSelect = page.getByLabel('Compatible measurement stream');
  await expect(streamSelect).toBeVisible();
  await streamSelect.selectOption({ index: 0 });
  const energyOptionValue = await streamSelect.locator('option', { hasText: 'Energy.Active.Import.Register' }).getAttribute('value');
  if (energyOptionValue) {
    await streamSelect.selectOption(energyOptionValue);
    await expect(page.getByText('Cumulative meter register stream')).toBeVisible();
  }
  const rawTable = page.getByRole('table');
  await expect(rawTable.getByText('7.4 kW').first()).toBeVisible();
  await expect(rawTable.getByText('8.2 kW').first()).toBeVisible();
  await expect(rawTable.getByText('12.5 kWh').first()).toBeVisible();
  await page.getByRole('navigation',{name:'Session sections'}).getByRole('link',{name:/Technical details/}).click();
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}/sessions/${transactionId}\\?section=technical$`));
  await expect(page.getByRole('heading',{name:'OCPP sequence completeness audit'})).toBeVisible();
  await page.goto('/sessions');
  await expect(page.getByRole('heading',{name:'Charging sessions',exact:true})).toBeVisible();
  await expect(page.getByText(transactionId,{exact:true}).first()).toBeVisible();
  await page.goto(`/transactions?station=${stationId}`);
  await expect(page).toHaveURL(new RegExp(`/sessions\\?stationId=${stationId}$`));
  await expect(page.getByText(transactionId,{exact:true}).first()).toBeVisible();
  await page.getByRole('link',{name:`Open session ${transactionId} at ${stationId}`}).click();
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}/sessions/${transactionId}\\?returnTo=`));
  await expect(page.getByRole('heading',{name:`Session ${transactionId}`,exact:true})).toBeVisible();
  await page.goto('/operations');
  await expect(page).toHaveURL(/\/diagnostics$/);
  await page.getByLabel('Exact station lookup',{exact:true}).fill(stationId);
  await page.getByRole('button',{name:'Apply filters'}).click();
  await expect(page).toHaveURL(new RegExp(`/diagnostics\\?stationId=${stationId}$`));
  const row=page.getByRole('row').filter({hasText:stationId});
  await expect(row).toContainText('Online');
  await row.getByRole('link',{name:stationId,exact:true}).click();
  await expect(page.getByRole('heading',{name:'Operator E2E Station'})).toBeVisible();

  await page.goto('/attention');
  await expect(page.getByRole('heading',{name:'Needs attention',exact:true})).toBeVisible();
  await expect(page.getByText(incompleteTxId,{exact:true}).first()).toBeVisible();
  await page.getByRole('link',{name:`Sequence details for session ${incompleteTxId} at ${stationId}`}).click();
  await expect(page).toHaveURL(new RegExp(`/stations/${stationId}/sessions/${incompleteTxId}\\?section=technical&returnTo=%2Fattention$`));
  await expect(page.getByRole('heading',{name:'OCPP sequence completeness audit'})).toBeVisible();

  await page.goto('/help');
  await expect(page.getByRole('heading',{name:'Help',exact:true})).toBeVisible();
  const nav = page.getByRole('navigation',{name:'Primary navigation'});
  for (const label of ['Overview','Charging stations','Charging sessions','Needs attention','Diagnostics','Help']) {
   await expect(nav.getByRole('link',{name:label,exact:true})).toBeVisible();
  }

  // Wait for the tenant-scoped projections after the device disconnects.
  socket.close();
  await expect.poll(async () => {
   await page.goto(`/diagnostics?stationId=${stationId}`);
   return page.getByRole('row').filter({hasText:stationId}).innerText({timeout:1500}).catch(() => '');
  }, {timeout:30_000}).toContain('Offline');
  await page.goto(`/stations/${stationId}`);
  await expect(page.getByText('Station is currently reported offline').first()).toBeVisible();

  const outside = await browser.newPage();
  try {
   await signIn(outside, origin, 'operator-b');
   await outside.goto(`/stations/${stationId}`);
   await expect(outside.getByRole('heading', { name: 'This station or transaction could not be found.' })).toBeVisible();
  } finally {
   await outside.close();
  }

  await page.goto('/admin/credentials');
  const forms = page.locator('form').filter({
   has: page.locator(`input[name="stationId"][value="${stationId}"]`),
  });
  const rotate = forms.filter({ has: page.getByRole('button', { name: 'Rotate', exact: true }) });
  const revoke = forms.filter({ has: page.getByRole('button', { name: 'Revoke Credential', exact: true }) });
  const rotatedPassword = randomBytes(32).toString('hex');

  const previous = await connectStation(stationId, password);
  let previousCloseCode: number | undefined;
  previous.addEventListener('close', event => { previousCloseCode = event.code; }, { once: true });
  try {
   await rotate.locator('input[name="newPassword"]').fill(rotatedPassword);
   await rotate.getByRole('button', { name: 'Rotate', exact: true }).click();
   await expect.poll(() => previousCloseCode).toBe(1008);
   await expect(connectStation(stationId, password)).rejects.toThrow('OCPP connection rejected');
  } finally {
   previous.close();
  }

  const replacement = await connectStation(stationId, rotatedPassword);
  let replacementCloseCode: number | undefined;
  replacement.addEventListener('close', event => { replacementCloseCode = event.code; }, { once: true });
  try {
   await revoke.getByRole('button', { name: 'Revoke Credential', exact: true }).click();
   await expect.poll(() => replacementCloseCode).toBe(1008);
   await expect(connectStation(stationId, rotatedPassword)).rejects.toThrow('OCPP connection rejected');
  } finally {
   replacement.close();
  }

  await page.goto('/admin/audit');
  await expect(page.getByText('CREDENTIAL_ROTATED', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('CREDENTIAL_REVOKED', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
 } finally { socket.close(); }
});
