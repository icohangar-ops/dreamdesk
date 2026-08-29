/* Screenshot caption overlays (transparent PNGs, 1920x1080). */
const { chromium } = require("/home/z/.npm-global/lib/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2000, height: 2400 }, deviceScaleFactor: 1 });
  await page.goto("file:///home/z/my-project/video-assets/cards/captions.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  for (let i = 1; i <= 7; i++) {
    await page.locator("#c" + i).screenshot({ path: `/home/z/my-project/video-assets/cards/caption-${i}.png` });
    console.log("caption", i);
  }
  await browser.close();
  console.log("CAPTIONS DONE");
})().catch((e) => { console.error(e); process.exit(1); });
