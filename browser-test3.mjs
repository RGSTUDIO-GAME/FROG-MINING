import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' -> ' + (r.failure()?.errorText || '')));

console.log('=== BUKA RAILWAY ===');
await page.goto('https://frog-mining-production.up.railway.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);
console.log('popup awal:', JSON.stringify(await page.locator('.popup-message').allInnerTexts()));

// Klik nav Mail (bottom nav item ke-4)
const nav = page.locator('.bottom-nav-item, .bottom-nav button');
console.log('nav count:', await nav.count());
const navTexts = await nav.allInnerTexts();
console.log('nav:', JSON.stringify(navTexts));
const mailIdx = navTexts.findIndex((t) => t.includes('Mail'));
if (mailIdx >= 0) { await nav.nth(mailIdx).click(); } else { console.log('nav mail tidak ketemu'); }
await page.waitForTimeout(2500);

const mailItems = await page.locator('.mail-item').count();
console.log('jumlah mail:', mailItems);
const itemText = mailItems > 0 ? (await page.locator('.mail-item').first().innerText()).replace(/\n/g, ' | ') : '';
console.log('mail:', itemText.slice(0, 150));

if (mailItems > 0) {
  await page.locator('.mail-item').first().click();
  await page.waitForTimeout(1200);
  const claimBtn = page.locator('#mail-claim');
  console.log('tombol claim:', await claimBtn.count());
  if (await claimBtn.count() > 0) {
    await claimBtn.click();
    await page.waitForTimeout(3000);
  }
}
console.log('POPUP akhir:', JSON.stringify(await page.locator('.popup-message').allInnerTexts()));
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
