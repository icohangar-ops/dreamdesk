/* Screenshot each card + thumbnail from cards.html at exact sizes. */
const { chromium } = require("/home/z/.npm-global/lib/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2000, height: 2400 }, deviceScaleFactor: 1 });
  await page.goto("file:///home/z/my-project/video-assets/cards/cards.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const targets = [
    { id: "s1", w: 1920, h: 1080, out: "card1-title.png" },
    { id: "s2", w: 1920, h: 1080, out: "card2-market.png" },
    { id: "s3", w: 1920, h: 1080, out: "card3-pipeline.png" },
    { id: "s4", w: 1920, h: 1080, out: "card4-evidence.png" },
    { id: "s5", w: 1920, h: 1080, out: "card5-outro.png" },
    { id: "thumb", w: 1280, h: 720, out: "thumbnail-1280x720.png" },
  ];

  for (const t of targets) {
    const el = page.locator("#" + t.id);
    await el.screenshot({ path: "/home/z/my-project/video-assets/cards/" + t.out });
    console.log("shot", t.out);
  }
  await browser.close();
  console.log("ALL CARDS DONE");
})().catch((e) => { console.error(e); process.exit(1); });
