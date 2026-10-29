const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const log = {};
    log.c1 = Hand.collect('ranger'); log.c2 = Hand.collect('mage'); log.c3 = Hand.collect('knight');
    log.c4 = Hand.collect('ranger'); log.c5 = Hand.collect('mage');
    log.slots = Hand.slots(); log.deck = Hand.deckCount();
    log.discard1 = Hand.discard(0);
    log.afterDiscard = Hand.slots(); log.deckAfter = Hand.deckCount();
    return log;
  });
  console.log(JSON.stringify(r));
  console.log('errors', errors);
  await browser.close();
})();
