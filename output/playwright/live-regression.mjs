import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = path.resolve('output/playwright');
const playwrightModulePath = 'C:/Users/manud/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightModulePath).href);
const baseUrl = 'http://localhost:3000/';
const chromiumExecutablePath = 'C:/Users/manud/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';

async function ensureOutDir() {
    await fs.mkdir(outDir, { recursive: true });
}

async function saveScreenshot(page, name) {
    await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function waitForScene(page, sceneKey) {
    await page.waitForFunction((key) => {
        const scene = window.game?.scene?.keys?.[key];
        return Boolean(scene && scene.sys?.isActive?.());
    }, sceneKey, { timeout: 20000 });
}

async function readTurnState(page) {
    return page.evaluate(() => {
        const scene = window.game.scene.keys.GameScene;
        const room = scene.serverManager.room;
        const state = room.state;
        const me = state.players.get(room.sessionId);
        return {
            myId: room.sessionId,
            currentTurnPlayerId: state.currentTurnPlayerId,
            phase: state.phase,
            hand: Array.from(me.hand).map((card) => ({ id: card.id, type: card.type, name: card.name })),
            company: Array.from(me.company).map((card) => ({ id: card.id, type: card.type, name: card.name })),
            crises: Array.from(state.centralCrises).map((card) => ({ id: card.id, type: card.type, name: card.name, costPA: card.costPA })),
        };
    });
}

async function isMyTurn(page) {
    const turn = await readTurnState(page);
    return turn.myId === turn.currentTurnPlayerId;
}

async function loginHost(page, name) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForScene(page, 'LoginScene');
    await page.evaluate(async (playerName) => {
        const scene = window.game.scene.keys.LoginScene;
        scene.setMode('host');
        await scene.refreshHostRoomCode();
        scene.nameInput.value = playerName;
        scene.nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        await scene.handleJoin();
    }, name);
    await waitForScene(page, 'PreLobbyScene');
    return page.evaluate(() => window.game.scene.keys.PreLobbyScene.roomCode);
}

async function loginGuest(page, name, roomCode) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForScene(page, 'LoginScene');
    await page.evaluate(async ({ playerName, joinCode }) => {
        const scene = window.game.scene.keys.LoginScene;
        scene.setMode('join');
        scene.nameInput.value = playerName;
        scene.nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        scene.roomCodeInput.value = joinCode;
        scene.roomCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await scene.handleJoin();
    }, { playerName: name, joinCode: roomCode });
    await waitForScene(page, 'PreLobbyScene');
}

async function clickPreLobbyAction(page) {
    await page.evaluate(() => window.game.scene.keys.PreLobbyScene.handleActionClick());
}

async function waitForGame(page) {
    await waitForScene(page, 'GameScene');
    await page.waitForFunction(() => Boolean(window.game.scene.keys.GameScene.serverManager?.room?.state));
}

async function captureResponsive(browser) {
    const shots = [
        {
            name: 'milestone-login-390x844.png',
            viewport: { width: 390, height: 844 },
            url: `${baseUrl}?qaScreen=login&lang=it`,
            sceneKey: 'LoginScene',
        },
        {
            name: 'milestone-prelobby-390x844.png',
            viewport: { width: 390, height: 844 },
            url: `${baseUrl}?qaScreen=prelobby&qaPreLobby=1&lang=it`,
            sceneKey: 'PreLobbyScene',
        },
        {
            name: 'milestone-match-390x844.png',
            viewport: { width: 390, height: 844 },
            url: `${baseUrl}?qaMatch=1&qaState=my_turn&lang=it`,
            sceneKey: 'GameScene',
        },
        {
            name: 'milestone-match-reaction-844x390.png',
            viewport: { width: 844, height: 390 },
            url: `${baseUrl}?qaMatch=1&qaState=reaction_window&lang=it`,
            sceneKey: 'GameScene',
        },
    ];

    for (const shot of shots) {
        const context = await browser.newContext({ viewport: shot.viewport });
        const page = await context.newPage();
        await page.goto(shot.url, { waitUntil: 'domcontentloaded' });
        await waitForScene(page, shot.sceneKey);
        await page.waitForTimeout(500);
        await saveScreenshot(page, shot.name);
        await context.close();
    }
}

await ensureOutDir();
const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutablePath });
const hostContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const guestContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const hostPage = await hostContext.newPage();
const guestPage = await guestContext.newPage();
const summary = {
    roomCode: '',
    hostName: 'HostRefactor',
    guestName: 'GuestRefactor',
    steps: [],
    errors: [],
};

for (const page of [hostPage, guestPage]) {
    page.on('console', (message) => {
        if (message.type() === 'error') {
            summary.errors.push(message.text());
        }
    });
}

try {
    const roomCode = await loginHost(hostPage, summary.hostName);
    summary.roomCode = roomCode;
    await saveScreenshot(hostPage, 'milestone-live-host-prelobby.png');
    await loginGuest(guestPage, summary.guestName, roomCode);
    await saveScreenshot(guestPage, 'milestone-live-guest-prelobby.png');
    summary.steps.push('host_login');
    summary.steps.push('guest_login');

    await clickPreLobbyAction(hostPage);
    await clickPreLobbyAction(guestPage);
    await hostPage.waitForTimeout(400);
    await saveScreenshot(hostPage, 'milestone-live-host-ready.png');
    await saveScreenshot(guestPage, 'milestone-live-guest-ready.png');
    summary.steps.push('both_ready');

    await clickPreLobbyAction(hostPage);
    await Promise.all([waitForGame(hostPage), waitForGame(guestPage)]);
    await hostPage.waitForTimeout(800);
    await saveScreenshot(hostPage, 'milestone-live-host-match.png');
    await saveScreenshot(guestPage, 'milestone-live-guest-match.png');
    summary.steps.push('match_started');

    const firstActivePage = await isMyTurn(hostPage) ? hostPage : guestPage;
    const firstWaitingPage = firstActivePage === hostPage ? guestPage : hostPage;

    await firstActivePage.evaluate(() => window.game.scene.keys.GameScene.openPrimaryInfoOverlay());
    await firstActivePage.waitForTimeout(250);
    await saveScreenshot(firstActivePage, 'milestone-live-info-overlay.png');
    await firstActivePage.evaluate(() => window.game.scene.keys.GameScene.handleEscapeKey());
    summary.steps.push('info_overlay');

    const playedHeroId = await firstActivePage.evaluate(() => {
        const scene = window.game.scene.keys.GameScene;
        const room = scene.serverManager.room;
        const me = room.state.players.get(room.sessionId);
        const hero = Array.from(me.hand).find((card) => {
            const type = String(card.type ?? '').toLowerCase();
            return type === 'hero' || type === 'employee';
        });
        if (!hero) return null;
        scene.serverManager.playEmployee(hero.id);
        return hero.id;
    });
    if (playedHeroId) {
        await firstActivePage.waitForTimeout(500);
        await saveScreenshot(firstActivePage, 'milestone-live-after-play-employee.png');
        await saveScreenshot(firstWaitingPage, 'milestone-live-reaction-window.png');
        await firstActivePage.waitForTimeout(5600);
        await saveScreenshot(firstActivePage, 'milestone-live-after-employee-resolve.png');
        summary.steps.push('play_employee');
    }

    const attackPayload = await firstActivePage.evaluate(() => {
        const scene = window.game.scene.keys.GameScene;
        const room = scene.serverManager.room;
        const crisis = Array.from(room.state.centralCrises)[0];
        const me = room.state.players.get(room.sessionId);
        const hero = Array.from(me.company).find((card) => {
            const type = String(card.type ?? '').toLowerCase();
            return type === 'hero' || type === 'employee';
        });
        if (!crisis || !hero) return null;
        scene.tryAttackCrisis(crisis);
        return { crisisId: crisis.id, heroId: hero.id };
    });
    if (attackPayload) {
        await firstActivePage.waitForTimeout(300);
        await saveScreenshot(firstActivePage, 'milestone-live-attack-overlay.png');
        await firstActivePage.evaluate((payload) => {
            const scene = window.game.scene.keys.GameScene;
            scene.serverManager.solveCrisis(payload.crisisId, payload.heroId);
        }, attackPayload);
        await firstActivePage.waitForTimeout(500);
        await saveScreenshot(firstWaitingPage, 'milestone-live-attack-reaction-window.png');
        await firstActivePage.waitForTimeout(5600);
        await saveScreenshot(firstActivePage, 'milestone-live-after-attack.png');
        summary.steps.push('attack_crisis');
    }

    await firstActivePage.evaluate(() => window.game.scene.keys.GameScene.tryEndTurn());
    await firstActivePage.waitForTimeout(1000);
    summary.steps.push('first_end_turn');

    const secondActivePage = await isMyTurn(hostPage) ? hostPage : guestPage;
    await secondActivePage.evaluate(() => window.game.scene.keys.GameScene.tryDrawCard());
    await secondActivePage.waitForTimeout(800);
    await saveScreenshot(secondActivePage, 'milestone-live-after-draw.png');
    summary.steps.push('second_draw');

    await secondActivePage.evaluate(() => window.game.scene.keys.GameScene.tryEndTurn());
    await secondActivePage.waitForTimeout(1000);
    summary.steps.push('second_end_turn');

    await captureResponsive(browser);
    summary.steps.push('responsive_captures');

    summary.hostTurn = await readTurnState(hostPage);
    summary.guestTurn = await readTurnState(guestPage);
} finally {
    await fs.writeFile(path.join(outDir, 'milestone-live-summary.json'), JSON.stringify(summary, null, 2));
    await hostContext.close();
    await guestContext.close();
    await browser.close();
}