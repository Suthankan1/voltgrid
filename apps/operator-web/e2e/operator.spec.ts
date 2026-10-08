import { test, expect } from '@playwright/test';
test('dashboard to station details and transaction inspector', async ({ page }) => {
 await page.goto('/');
 await page.getByRole('link',{name:'Colombo Central'}).click();
 await expect(page.getByRole('heading',{name:'Colombo Central'})).toBeVisible();
 await expect(page.getByText('AVAILABLE',{exact:true}).first()).toBeVisible();
 await page.goto('/stations/CP-1/transactions/TX-1');
 await expect(page.getByRole('heading',{name:'TX-1',exact:true})).toBeVisible();
 await expect(page.getByText('Integrity assessment',{exact:true})).toBeVisible();
});
test('transaction ledger renders and active filter excludes ended sessions', async ({ page }) => {
 await page.goto('/transactions');
 await expect(page.getByRole('heading',{name:'Transaction operations'})).toBeVisible();
 await expect(page.getByText('TX-1',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Active',exact:true}).click();
 await expect(page.getByText('TX-1',{exact:true})).toHaveCount(0);
});
test('Operations navigation, cursor pagination and failure state', async ({ page }) => {
 await page.goto('/');
 await page.getByRole('link',{name:'View Operations status →'}).click();
 await expect(page.getByRole('heading',{name:'Operations status'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'ONLINE',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Next page →'}).click();
 await expect(page).toHaveURL(/after=cursor-2/);
 await expect(page.getByText('No projected stations.',{exact:true})).toBeVisible();
 await page.goto('/operations?after=failure');
 await expect(page.getByRole('alert').filter({hasText:'Operations data'})).toContainText('could not be loaded');
});
test('unknown station and transaction return 404', async ({ page }) => {
 expect((await page.goto('/stations/missing'))?.status()).toBe(404);
 expect((await page.goto('/stations/CP-1/transactions/missing'))?.status()).toBe(404);
});

test('Operations filter resets the cursor and persists on next page', async ({page}) => {
 await page.goto('/operations?after=cursor-2');
 await page.getByLabel('Station status').selectOption('OFFLINE');
 await page.getByRole('button',{name:'Apply status filter'}).click();
 await expect(page).toHaveURL(/status=OFFLINE/);
 expect(new URL(page.url()).searchParams.has('after')).toBe(false);
 await expect(page.getByRole('cell',{name:'OFFLINE',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Next page →'}).click();
 await expect(page).toHaveURL(/status=OFFLINE/);
 await page.goto('/operations?status=ONLINE&status=OFFLINE');
 await expect(page.getByRole('cell',{name:'ONLINE',exact:true})).toBeVisible();
});
test('literal percent identifiers are decoded once', async ({page}) => {
 expect((await page.goto('/stations/CP%251'))?.status()).toBe(200);
 await expect(page.getByRole('heading',{name:'Colombo Central'})).toBeVisible();
 expect((await page.goto('/stations/CP%251/transactions/TX%251'))?.status()).toBe(200);
 await expect(page.getByRole('heading',{name:'TX%1',exact:true})).toBeVisible();
});

test('shared navigation, keyboard skip link and refresh work on every view', async ({page}) => {
 for (const route of ['/', '/transactions','/operations','/stations/CP-1']) {
  await page.goto(route);
  const navigation=page.getByRole('navigation',{name:'Operator navigation'});
  await expect(navigation.getByRole('link',{name:'Operations',exact:true})).toBeVisible();
  await expect(page.locator('main#main-content')).toHaveCount(1);
  await page.getByRole('button',{name:'Refresh data'}).click();
  await expect(page.getByRole('button',{name:'Refresh data'})).toBeEnabled();
 }
 await page.goto('/');
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
 await page.goto('/stations/missing');
 await expect(page.getByRole('heading',{name:'This station or transaction could not be found.'})).toBeVisible();
});

test('operator views fit mobile and retain navigation', async ({page}, testInfo) => {
 await page.setViewportSize({width:390,height:844});
 for (const [name,route] of [['network','/'],['transactions','/transactions'],['operations','/operations'],['station','/stations/CP-1'],['inspector','/stations/CP-1/transactions/TX-1']]) {
  await page.goto(route);
  await expect(page.getByRole('navigation',{name:'Operator navigation'})).toBeVisible();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('main:visible')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`${name}-mobile.png`),fullPage:true});
 }
});

test('dark action links retain readable white text', async ({page}) => {
 await page.goto('/');
 const action=page.getByRole('link',{name:'Open transactions →'});
 expect(await action.evaluate(element=>getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
});

test('fleet search combines name and connectivity while retaining network totals', async ({page}) => {
 await page.goto('/');
 await page.getByLabel('Search stations').fill('Colombo');
 await page.getByLabel('Connectivity',{exact:true}).selectOption('OFFLINE');
 await page.getByRole('button',{name:'Search fleet'}).click();
 await expect(page.getByText('No stations match the selected filters.')).toBeVisible();
 await page.getByRole('link',{name:'Clear filters'}).click();
 await expect(page.getByLabel('Search stations')).toHaveValue('');
 await expect(page.getByLabel('Connectivity',{exact:true})).toHaveValue('');
 await page.getByLabel('Connectivity',{exact:true}).selectOption('OFFLINE');
 await page.getByRole('button',{name:'Search fleet'}).click();
 await expect(page.getByRole('link',{name:'Kandy Depot →',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Colombo Central →',exact:true})).toHaveCount(0);
});
test('local registration redirects to the new offline station and reports duplicates', async ({page}) => {
 await page.goto('/stations/new');
 await page.getByLabel('Station identifier',{exact:true}).fill('NEW-CP-1');
 await page.getByLabel('Station name',{exact:true}).fill('New local station');
 await page.getByRole('button',{name:'Register station',exact:true}).click();
 await expect(page).toHaveURL(/stations\/NEW-CP-1/);
 await expect(page.getByRole('heading',{name:'New local station'})).toBeVisible();
 await page.goto('/stations/new');
 await page.getByLabel('Station identifier',{exact:true}).fill('NEW-CP-1');
 await page.getByLabel('Station name',{exact:true}).fill('Duplicate');
 await page.getByRole('button',{name:'Register station',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'already registered'})).toBeVisible();
});
