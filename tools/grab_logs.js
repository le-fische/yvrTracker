const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.message}`);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log("Page loaded. Waiting 10 seconds for the black screen to happen...");
    await new Promise(r => setTimeout(r, 10000));
  } catch (err) {
    console.error("Puppeteer script error:", err);
  } finally {
    await browser.close();
  }
})();
