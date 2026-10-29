// Menu flow: title -> play -> pause -> title; title -> credits -> title.
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'changeling.html');
const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await wait(page, 300);
  const name = () => page.evaluate(() => Engine.current().constructor.name);
  const out = {};
  out.start = await name();
  await page.keyboard.press('Enter'); await wait(page, 80);
  out.afterPlay = await name();
  await page.keyboard.press('Enter'); await wait(page, 80);
  out.pauseMode = await page.evaluate(() => Engine.current().mode);
  await page.keyboard.press('KeyX'); await wait(page, 80);
  out.resumed = await page.evaluate(() => Engine.current().mode);
  await page.keyboard.press('Enter'); await wait(page, 80);
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page, 80);
  out.backToTitle = await name();
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page, 80);
  out.credits = await name();
  await page.keyboard.press('KeyX'); await wait(page, 80);
  out.creditsBack = await name();
  await page.screenshot({ path: __dirname + '/title.png' });
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
