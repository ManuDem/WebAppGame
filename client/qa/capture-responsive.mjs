import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = process.env.QA_URL || "http://localhost:3000/";
const waitMs = Number(process.env.QA_WAIT_MS || 4500);
const outputDir = process.env.QA_OUT_DIR || "qa/output";

const viewports = [
  { label: "360x640-portrait", width: 360, height: 640 },
  { label: "390x844-portrait", width: 390, height: 844 },
  { label: "414x896-portrait", width: 414, height: 896 },
  { label: "768x1024-portrait", width: 768, height: 1024 },
  { label: "896x414-landscape", width: 896, height: 414 },
  { label: "1024x768-landscape", width: 1024, height: 768 },
  { label: "1366x768-landscape", width: 1366, height: 768 },
];

async function launchBrowser() {
  const tries = [
    { name: "chrome", opts: { headless: true, channel: "chrome" } },
    { name: "msedge", opts: { headless: true, channel: "msedge" } },
    { name: "bundled", opts: { headless: true } },
  ];

  for (const t of tries) {
    try {
      const browser = await chromium.launch(t.opts);
      return { browser, channel: t.name };
    } catch (err) {
      console.log("RESPONSIVE_CAPTURE_LAUNCH_FAILED", t.name, String(err?.message || err));
    }
  }
  return null;
}

const launched = await launchBrowser();
if (!launched) {
  console.error("FATAL: unable to launch chromium for responsive capture");
  process.exit(3);
}

const { browser, channel } = launched;
await mkdir(outputDir, { recursive: true });

const summary = [];
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  let gotoError = null;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(waitMs);
    const filePath = `${outputDir}/${vp.label}.png`;
    await page.screenshot({ path: filePath, fullPage: true });
    summary.push({ viewport: vp.label, ok: true, filePath });
  } catch (err) {
    gotoError = String(err?.message || err);
    summary.push({ viewport: vp.label, ok: false, error: gotoError });
  } finally {
    await context.close();
  }
}

await browser.close();

console.log("===RESPONSIVE_CAPTURE_CHANNEL===");
console.log(channel);
console.log("===RESPONSIVE_CAPTURE_SUMMARY===");
console.log(JSON.stringify(summary, null, 2));
