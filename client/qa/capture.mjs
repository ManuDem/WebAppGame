import { chromium } from "playwright";

const url = process.env.QA_URL || "http://localhost:3000/";
const waitMs = Number(process.env.QA_WAIT_MS || 5000);
const preferredChannel = (process.env.QA_CHANNEL || "").trim(); // "chrome" | "msedge" | ""

async function launchAnyChromium() {
  const baseTries = [
    { name: "chromium-channel-chrome", opts: { headless: true, channel: "chrome" } },
    { name: "chromium-channel-msedge", opts: { headless: true, channel: "msedge" } },
    { name: "chromium-bundled", opts: { headless: true } },
  ];

  const tries =
    preferredChannel === "chrome"
      ? [baseTries[0], baseTries[1], baseTries[2]]
      : preferredChannel === "msedge"
        ? [baseTries[1], baseTries[0], baseTries[2]]
        : baseTries;

  for (const t of tries) {
    try {
      const browser = await chromium.launch(t.opts);
      return { browser, launchedVia: t.name };
    } catch (e) {
      console.log("LAUNCH_FAILED", t.name, String(e?.message || e));
    }
  }
  return null;
}

const launched = await launchAnyChromium();
if (!launched) {
  console.error("FATAL: could not launch any Chromium (chrome/msedge/bundled).");
  process.exit(3);
}

const { browser, launchedVia } = launched;
const page = await browser.newPage();

const consoleLogs = [];
const pageErrors = [];
const requestFailed = [];
const badStatus = [];
const requests = [];
const responses = [];
const websockets = [];

page.on("request", (req) => {
  requests.push({
    method: req.method(),
    url: req.url(),
    resourceType: req.resourceType(),
  });
});
page.on("console", (msg) => consoleLogs.push(`[console.${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) =>
  pageErrors.push(`[pageerror] ${err?.stack ? err.stack : String(err)}`)
);
page.on("requestfailed", (req) =>
  requestFailed.push(
    `[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText || "(unknown)"}`
  )
);
page.on("response", (res) => {
  const s = res.status();
  responses.push({
    status: s,
    method: res.request().method(),
    url: res.url(),
    resourceType: res.request().resourceType(),
  });
  if (s >= 400) badStatus.push(`[${s}] ${res.request().method()} ${res.url()}`);
});
page.on("websocket", (ws) => {
  const entry = { url: ws.url(), opened: true, closed: false, closeCode: null, closeReason: null };
  websockets.push(entry);
  ws.on("close", (evt) => {
    entry.closed = true;
    entry.closeCode = evt?.code ?? null;
    entry.closeReason = evt?.reason ?? null;
  });
});

let gotoError = null;
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
} catch (e) {
  gotoError = String(e?.message || e);
}

await page.waitForTimeout(waitMs);

const metrics = await page.evaluate(() => ({
  title: document.title,
  readyState: document.readyState,
  hasApp: !!document.querySelector("#app"),
  canvasCount: document.querySelectorAll("canvas").length,
  bodyBg: getComputedStyle(document.body).background,
  bodyBgColor: getComputedStyle(document.body).backgroundColor,
  location: location.href,
}));

console.log("===PLAYWRIGHT_LAUNCHED_VIA===\n" + launchedVia);
console.log("===URL===\n" + url);
console.log("===GOTO_ERROR===\n" + (gotoError || "(none)"));
console.log("===PAGE_METRICS===\n" + JSON.stringify(metrics, null, 2));
console.log("===CONSOLE===\n" + (consoleLogs.join("\n") || "(none)"));
console.log("===PAGE_ERRORS===\n" + (pageErrors.join("\n") || "(none)"));
console.log("===NETWORK_REQUEST_FAILED===\n" + (requestFailed.join("\n") || "(none)"));
console.log("===NETWORK_BAD_STATUS(>=400)===\n" + (badStatus.join("\n") || "(none)"));
console.log(
  "===NETWORK_SUMMARY===\n" +
    JSON.stringify(
      {
        requestCount: requests.length,
        responseCount: responses.length,
        badStatusCount: responses.filter((r) => r.status >= 400).length,
        topBadStatuses: Array.from(
          responses
            .filter((r) => r.status >= 400)
            .reduce((m, r) => m.set(r.status, (m.get(r.status) || 0) + 1), new Map())
            .entries()
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        sampleRequests: requests.slice(0, 20),
        badResponses: responses.filter((r) => r.status >= 400).slice(0, 50),
        websockets,
      },
      null,
      2
    )
);

await browser.close();

