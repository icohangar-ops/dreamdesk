/* Record a guided tour of the live DreamDesk trading floor at 1920x1080. */
const path = "/home/z/.npm-global/lib/node_modules/playwright";
const { chromium } = require(path);

const OUT = "/home/z/my-project/video-assets/raw/floor-tour.webm";
const URL = "http://localhost:3000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollToSection(page, titleText) {
  await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll("*"));
    const el = els.find(
      (e) => e.children.length === 0 && e.textContent && e.textContent.trim() === t
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, titleText);
  await sleep(1600); // let smooth scroll land
}

async function hold(page, ms) {
  await sleep(ms);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--force-device-scale-factor=1", "--hide-scrollbars"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: "/home/z/my-project/video-assets/raw", size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  console.log("navigating…");
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000); // SSE first snapshot + sparkline ticks

  // --- Act 1: top console, live price feed (18s) ---
  console.log("act1 console");
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await hold(page, 18000);

  // --- Act 2: signal agents (16s) ---
  console.log("act2 agents");
  await scrollToSection(page, "01 · Signal Agents");
  await hold(page, 16000);

  // --- Act 3: council chamber (16s) ---
  console.log("act3 council");
  await scrollToSection(page, "02 · Council Chamber");
  await hold(page, 16000);

  // --- Act 4: risk gates (10s) ---
  console.log("act4 gates");
  await scrollToSection(page, "03 · Risk Gates");
  await hold(page, 10000);

  // --- Act 5: order book (12s) ---
  console.log("act5 book");
  await scrollToSection(page, "04 · Order Book");
  await hold(page, 12000);

  // --- Act 6: audit ledger (18s) ---
  console.log("act6 ledger");
  await scrollToSection(page, "05 · Audit Ledger");
  await hold(page, 18000);

  // --- Act 7: back to top, force cycle, watch pipeline (35s) ---
  console.log("act7 force cycle");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(1500);
  const btn = page.locator('button:has-text("Force cycle")');
  if (await btn.count()) {
    await btn.first().click();
    console.log("cycle forced");
  } else {
    console.log("force-cycle button not found");
  }
  await hold(page, 14000);

  console.log("act8 council during cycle");
  await scrollToSection(page, "02 · Council Chamber");
  await hold(page, 12000);

  console.log("act9 ledger after cycle");
  await scrollToSection(page, "05 · Audit Ledger");
  await hold(page, 12000);

  // --- Act 10: close on console (12s) ---
  console.log("act10 close");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(12000);

  await page.close();
  const video = page.video();
  await ctx.close();
  if (video) {
    await video.saveAs(OUT);
    console.log("saved", OUT);
  }
  await browser.close();
})().catch((e) => {
  console.error("RECORD FAILED:", e.message);
  process.exit(1);
});
