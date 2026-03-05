import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const requestedBaseUrl = process.env.QA_URL || "http://localhost:3000/";
const waitMs = Number(process.env.QA_WAIT_MS || 4500);
const outputDir = process.env.QA_OUT_DIR || "qa/output/match";
const hardTimeoutMs = Number(process.env.QA_HARD_TIMEOUT_MS || 30000);

const viewports = [
  { label: "360x640", width: 360, height: 640 },
  { label: "390x844", width: 390, height: 844 },
  { label: "414x896", width: 414, height: 896 },
  { label: "768x1024", width: 768, height: 1024 },
  { label: "844x390", width: 844, height: 390 },
  { label: "896x414", width: 896, height: 414 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "1366x768", width: 1366, height: 768 },
];
const languages = ["it", "en"];

function withQuery(url, params) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

function unique(values) {
  const out = [];
  for (const value of values) {
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function buildCandidateUrls(seedUrl) {
  const seeded = [];
  try {
    const parsed = new URL(seedUrl);
    seeded.push(parsed.toString());
  } catch {
    seeded.push(seedUrl);
  }

  const generated = [];
  for (const host of ["127.0.0.1", "localhost"]) {
    for (let port = 3000; port <= 3010; port += 1) {
      generated.push(`http://${host}:${port}/`);
    }
  }

  return unique([...seeded, ...generated]);
}

function resolveTier(width, height) {
  const portrait = height > width;
  if (portrait && width <= 390) return "A";
  if (portrait && width >= 391 && width <= 430) return "B";
  if (height <= 430 && width >= 720) return "C";
  if (width >= 431 && width <= 900 && height >= width) return "D";
  return "E";
}

function getSafeArea(width, height) {
  const tier = resolveTier(width, height);
  if (tier === "A" || tier === "B") {
    return { top: 12, right: 12, bottom: 12, left: 12, tier };
  }
  if (tier === "C") {
    return { top: 8, right: 10, bottom: 8, left: 10, tier };
  }
  return { top: 16, right: 16, bottom: 16, left: 16, tier };
}

async function collectLayoutIssues(page, viewport) {
  const safeArea = getSafeArea(viewport.width, viewport.height);
  return page.evaluate(({ safeArea }) => {
    const issues = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const checkRect = (name, rect, { enforceSafeArea } = { enforceSafeArea: true }) => {
      if (!rect) {
        issues.push(`${name}: missing`);
        return;
      }
      if (rect.width <= 0 || rect.height <= 0) {
        issues.push(`${name}: non-positive size`);
      }
      if (rect.left < 0 || rect.top < 0 || rect.right > vw || rect.bottom > vh) {
        issues.push(`${name}: outside viewport`);
      }
      if (
        enforceSafeArea
        && (rect.left < safeArea.left
          || rect.top < safeArea.top
          || rect.right > (vw - safeArea.right)
          || rect.bottom > (vh - safeArea.bottom))
      ) {
        issues.push(`${name}: outside safe area`);
      }
    };

    const isVisibleElement = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };

    const app = document.querySelector("#app");
    if (!app) {
      issues.push("#app missing");
    } else {
      checkRect("#app", app.getBoundingClientRect(), { enforceSafeArea: false });
    }

    const canvas = document.querySelector("canvas");
    if (!canvas) {
      issues.push("canvas missing");
    } else {
      checkRect("canvas", canvas.getBoundingClientRect(), { enforceSafeArea: false });
    }

    const uiRoot = document.querySelector('#ui-root');
    if (uiRoot) {
      checkRect('#ui-root', uiRoot.getBoundingClientRect(), { enforceSafeArea: false });
    }

    const domInputs = Array.from(document.querySelectorAll("input[type='text']")).filter(isVisibleElement);
    domInputs.forEach((input, index) => {
      checkRect(`input[${index}]`, input.getBoundingClientRect());
    });

    const criticalPanels = Array.from(
      document.querySelectorAll('#ui-root .ui-reconnect-overlay.active, #ui-root [data-qa-panel="critical"]'),
    ).filter(isVisibleElement);
    criticalPanels.forEach((panel, index) => {
      checkRect(`critical_panel[${index}]`, panel.getBoundingClientRect());
    });

    return {
      issues,
      safeArea,
      viewport: { width: vw, height: vh },
    };
  }, { safeArea });
}

async function launchBrowser() {
  const withTimeout = async (promise, timeoutMs) => await Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`launch timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

  const tries = [
    { name: "chrome", opts: { headless: true, channel: "chrome", timeout: 12000 } },
    { name: "msedge", opts: { headless: true, channel: "msedge", timeout: 12000 } },
    { name: "bundled", opts: { headless: true, timeout: 12000 } },
  ];

  for (const t of tries) {
    try {
      const browser = await withTimeout(chromium.launch(t.opts), 15000);
      return { browser, channel: t.name };
    } catch (err) {
      console.log("MATCH_CAPTURE_LAUNCH_FAILED", t.name, String(err?.message || err));
    }
  }
  return null;
}

async function resolveBaseUrl(browser) {
  const candidates = buildCandidateUrls(requestedBaseUrl);

  for (const candidate of candidates) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(candidate, { waitUntil: "domcontentloaded", timeout: 5000 });
      await context.close();
      return candidate;
    } catch {
      await context.close();
    }
  }

  return requestedBaseUrl;
}

const hardTimeout = setTimeout(() => {
  console.error(`FATAL: match capture hard-timeout after ${hardTimeoutMs}ms`);
  process.exit(4);
}, hardTimeoutMs);

const launched = await launchBrowser();
if (!launched) {
  clearTimeout(hardTimeout);
  console.error("FATAL: unable to launch chromium for match capture");
  process.exit(3);
}

const { browser, channel } = launched;
const baseUrl = await resolveBaseUrl(browser);
const targets = [];
for (const lang of languages) {
  targets.push({ key: `boot-${lang}`, url: withQuery(baseUrl, { lang, qaScreen: "boot" }), settleMs: 350 });
  targets.push({ key: `login-${lang}`, url: withQuery(baseUrl, { lang, qaScreen: "login" }), settleMs: waitMs });
  targets.push({ key: `prelobby-${lang}`, url: withQuery(baseUrl, { lang, qaScreen: "prelobby", qaPreLobby: 1 }), settleMs: waitMs });
  targets.push({ key: `match-${lang}`, url: withQuery(baseUrl, { qaMatch: 1, uiDebug: 1, qaState: "my_turn", lang }), settleMs: waitMs });
  targets.push({ key: `mock-${lang}`, url: withQuery(baseUrl, { qaMatch: 1, uiDebug: 1, qaState: "reaction_window", lang }), settleMs: waitMs });
  targets.push({ key: `inspect-${lang}`, url: withQuery(baseUrl, { qaMatch: 1, uiDebug: 1, qaState: "my_turn", qaInspect: 1, lang }), settleMs: waitMs });
  targets.push({ key: `help-${lang}`, url: withQuery(baseUrl, { qaMatch: 1, uiDebug: 1, qaState: "my_turn", qaHelp: 1, lang }), settleMs: waitMs });
}
await mkdir(outputDir, { recursive: true });

const summary = [];
for (const target of targets) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(String(err?.message || err));
    });

    try {
      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(target.settleMs ?? waitMs);

      const layoutCheck = await collectLayoutIssues(page, vp);
      const hardFail = layoutCheck.issues.length > 0 || pageErrors.length > 0;

      const filePath = `${outputDir}/${target.key}-${vp.label}.png`;
      await page.screenshot({ path: filePath, fullPage: true });
      summary.push({
        screen: target.key,
        viewport: vp.label,
        ok: !hardFail,
        filePath,
        layoutIssues: layoutCheck.issues,
        safeArea: layoutCheck.safeArea,
        consoleErrors,
        pageErrors,
      });
    } catch (err) {
      summary.push({
        screen: target.key,
        viewport: vp.label,
        ok: false,
        error: String(err?.message || err),
        consoleErrors,
        pageErrors,
      });
    } finally {
      await context.close();
    }
  }
}

await browser.close();
await writeFile(`${outputDir}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
clearTimeout(hardTimeout);

const failing = summary.filter((entry) => !entry.ok);
console.log("===MATCH_CAPTURE_CHANNEL===");
console.log(channel);
console.log("===MATCH_CAPTURE_URL===");
console.log(baseUrl);
console.log("===MATCH_CAPTURE_SUMMARY===");
console.log(JSON.stringify(summary, null, 2));
if (failing.length > 0) {
  console.error(`MATCH_CAPTURE_ASSERT_FAILED (${failing.length} entries)`);
  process.exitCode = 2;
}
