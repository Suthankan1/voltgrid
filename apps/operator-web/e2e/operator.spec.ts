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
