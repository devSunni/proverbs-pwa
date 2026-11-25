const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifestRaw = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');
const swRaw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const registryRaw = fs.readFileSync(path.join(ROOT, 'data', 'series-registry.js'), 'utf8');

const PACK_FILES = ['proverbs', 'idioms', 'chengyu', 'spelling'];

function loadAllSeriesPacks() {
  const sandbox = { window: {} };
  vm.runInNewContext(registryRaw, sandbox);
  for (const id of PACK_FILES) {
    const raw = fs.readFileSync(path.join(ROOT, 'data', `${id}.js`), 'utf8');
    vm.runInNewContext(raw, sandbox);
  }
  return sandbox.window;
}

test('All 4 series packs (proverbs, idioms, chengyu, spelling) are ready with 100 unique valid items each (400 total)', () => {
  const win = loadAllSeriesPacks();
  assert.equal(win.SERIES_REGISTRY.length, 4);

  let totalItems = 0;
  for (const id of PACK_FILES) {
    const reg = win.SERIES_REGISTRY.find(s => s.id === id);
    assert.ok(reg && reg.ready === true, `Series pack ${id} must be ready in SERIES_REGISTRY`);

    const pack = win.SERIES_DATA && win.SERIES_DATA[id];
    assert.ok(pack, `SERIES_DATA.${id} must be registered`);
    assert.ok(pack.titlePrefix && pack.titleBlue && pack.titleYellow && pack.unitName);
    assert.ok(Array.isArray(pack.groups) && pack.groups.length >= 4);
    assert.ok(Array.isArray(pack.quizModes) && pack.quizModes.length === 3);
    assert.ok(Array.isArray(pack.badges) && pack.badges.length === 4);

    const data = pack.items;
    assert.equal(data.length, 100, `Pack ${id} must have exact 100 items`);
    totalItems += data.length;

    const validGroupIds = new Set(pack.groups.filter(g => g.id !== 'all').map(g => g.id));
    const ids = new Set();
    const titles = new Set();
    const groupCounts = {};

    for (const item of data) {
      assert.ok(
        item.id && item.ch && item.t && item.m && item.s && item.ex && item.b,
        `Missing field on ${id} item ${JSON.stringify(item)}`
      );
      assert.ok(validGroupIds.has(item.ch), `Unknown group "${item.ch}" in ${id} id ${item.id}`);
      assert.ok(item.t.includes(item.b), `Blank word "${item.b}" not found in "${item.t}" (${id} id ${item.id})`);
      assert.ok(!ids.has(item.id), `Duplicate id in ${id}: ${item.id}`);
      assert.ok(!titles.has(item.t), `Duplicate title in ${id}: ${item.t}`);

      ids.add(item.id);
      titles.add(item.t);
      groupCounts[item.ch] = (groupCounts[item.ch] || 0) + 1;
    }

    // Verify group label counts match actual items
    for (const g of pack.groups) {
      if (g.id === 'all') continue;
      const m = g.label.match(/\((\d+)\)/);
      assert.ok(m, `Group label missing count in ${id}: ${g.label}`);
      assert.equal(groupCounts[g.id] || 0, Number(m[1]), `Group count mismatch for ${id}:${g.id}`);
    }
  }
  assert.equal(totalItems, 400);
});

test('index.html inline script and all external series scripts parse cleanly with zero syntax errors', () => {
  assert.doesNotThrow(() => new Function(registryRaw));
  for (const id of PACK_FILES) {
    const raw = fs.readFileSync(path.join(ROOT, 'data', `${id}.js`), 'utf8');
    assert.doesNotThrow(() => new Function(raw), `Syntax error in data/${id}.js`);
  }
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'Expected 1 inline <script> block');
  assert.doesNotThrow(() => new Function(scripts[0][1]));
});

test('PWA manifest.json is valid, installable, and supports portrait + landscape', () => {
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.id, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.lang, 'ko');
  assert.ok(manifest.name && manifest.short_name);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  const sizes = new Set(manifest.icons.map(i => i.sizes));
  const purposes = new Set(manifest.icons.map(i => i.purpose));
  assert.ok(sizes.has('192x192'), 'Must include 192x192 icon');
  assert.ok(sizes.has('512x512'), 'Must include 512x512 icon');
  assert.ok(purposes.has('any'), 'Must include any purpose icon');
  assert.ok(purposes.has('maskable'), 'Must include maskable purpose icon');

  for (const icon of manifest.icons) {
    assert.notEqual(icon.purpose, 'any maskable', 'Never combine any maskable in one entry');
    const iconPath = path.join(ROOT, icon.src.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(iconPath), `Icon file missing: ${icon.src}`);
  }
});

test('index.html references single external ./manifest.json, loads all 4 series packs, and registers sw.js safely', () => {
  const manifestLinks = html.match(/<link[^>]+rel=["']manifest["'][^>]*>/g) || [];
  assert.equal(manifestLinks.length, 1, 'Expected exactly 1 manifest link');
  assert.ok(html.includes('<link rel="manifest" href="./manifest.json" />'));
  assert.ok(!html.includes('data:application/manifest+json'), 'Must not inject data-URI manifest');
  assert.ok(!html.includes('data:image/jpeg;base64,'), 'Heavy inline base64 images should be extracted to assets/');
  assert.ok(html.includes('<script src="./data/series-registry.js"></script>'));
  for (const id of PACK_FILES) {
    assert.ok(html.includes(`<script src="./data/${id}.js"></script>`), `index.html must load ./data/${id}.js`);
  }
  assert.ok(html.includes("navigator.serviceWorker.register('./sw.js')"));
  assert.ok(html.includes('beforeinstallprompt'));
  assert.ok(html.includes('appinstalled'));
});

test('sw.js parses cleanly and all CORE_ASSETS exist on disk', () => {
  assert.doesNotThrow(() => new Function(swRaw));
  const m = swRaw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'CORE_ASSETS must be defined in sw.js');
  const assets = eval('[' + m[1] + ']');
  for (const a of assets) {
    if (a === './') continue;
    const p = path.join(ROOT, a.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(p), `SW core asset missing: ${a}`);
  }
});

test('Touch guards, dual-tier Korean TTS, dual profiles, series switcher, UI persistence, and responsive rules are wired', () => {
  assert.ok(html.includes('-webkit-touch-callout: none'), 'Long-press callout must be disabled');
  assert.ok(html.includes('user-select: none'), 'Global text selection must be disabled');
  assert.ok(html.includes("document.addEventListener('contextmenu'"), 'Context menu prevention must be wired');
  assert.ok(html.includes("document.addEventListener('dragstart'"), 'Drag prevention must be wired');
  assert.ok(html.includes('function resolveKoreanVoice()'), 'Korean voice resolver must exist');
  assert.ok(html.includes('function playFallbackTTS('), 'Fallback TTS must exist');
  assert.ok(html.includes('function speakKorean('), 'Dual-tier speakKorean must exist');
  assert.ok(html.includes('function persistUIState()'), 'UI state persistence must be wired');
  assert.ok(html.includes('function restoreUIStateFromProfile()'), 'UI state restoration must be wired');
  assert.ok(html.includes('function switchSeriesPack('), 'Series pack switching must be wired');
  assert.ok(html.includes('준우') && html.includes('지우'), 'Dual Junwoo/Jiwoo profiles must be wired');
  assert.ok(html.includes('@media (min-width: 768px)'), 'Tablet/Z Fold unfolded breakpoint must exist');
  assert.ok(html.includes('@media (max-width: 390px)'), 'Narrow phone/Z Fold cover breakpoint must exist');
});
