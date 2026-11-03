// Checks Select Design on fixtures/sections.html in headless Chrome, at three page widths: what Section
// and Element mode highlight at known points, what ↑ and ↓ move to, and what Full page lists.
// Run with `npm run sections:check`. It exits with an error if any check fails.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { build } from 'vite';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = 'http://127.0.0.1:5174/sections.html';
/** A wide window, the same window with the side panel open, and a phone. */
const WIDTHS = [1280, 1000, 390];

/**
 * `at` is a selector, `host >>> selector` for inside an open shadow root, or `{ gapAbove, offset }` for a
 * point in the empty strip above an element. `steps` are presses of ↑ (positive) or ↓ (negative).
 */
const PROBES = [
  { mode: 'section', at: '.hero h1', expect: 'section.hero' },
  { mode: 'section', at: '.hero h1', steps: 1, expect: 'main' },
  { mode: 'section', at: '.hero h1', steps: -1, expect: '.hero > .container' },
  { mode: 'section', at: '.site-header nav a', expect: 'header.site-header', widths: [1280, 1000] },
  { mode: 'section', at: '.site-header .logo', expect: 'header.site-header' },
  { mode: 'section', at: '.logo-row li', expect: 'section.logos' },
  { mode: 'section', at: '.feature-card p', expect: 'section.features' },
  { mode: 'section', at: '.plan .price', expect: '.block-pricing' },
  { mode: 'section', at: { gapAbove: '.block-pricing', offset: 6 }, expect: 'section.features' },
  { mode: 'section', at: '.faq summary', expect: 'section.faq' },
  { mode: 'section', at: '.faq iframe', expect: 'section.faq' },
  { mode: 'section', at: '.cta .button', expect: 'section.cta' },
  { mode: 'section', at: '.site-footer a', expect: 'footer.site-footer' },
  { mode: 'section', at: '.announcement', expect: '.announcement' },
  { mode: 'element', at: '.hero h1', expect: 'h1' },
  { mode: 'element', at: '.hero h1', steps: 1, expect: '.hero-copy' },
  // The badge's text belongs to the component itself; only its dot and pill are inside the shadow root.
  { mode: 'element', at: 'demo-badge', expect: 'demo-badge' },
  { mode: 'element', at: 'demo-badge >>> .dot', expect: '.dot' },
  { mode: 'element', at: 'demo-badge >>> .dot', steps: 1, expect: '.pill' },
  { mode: 'element', at: '.feature-card p', expect: 'p' },
  { mode: 'element', at: '.feature-card p', steps: 1, expect: 'article.feature-card' },
  { mode: 'element', at: '.faq iframe', expect: 'iframe' },
];

const OUTLINE = [
  '.announcement',
  'header.site-header',
  'section.hero',
  'section.logos',
  'section.features',
  '.block-pricing',
  'section.faq',
  'section.cta',
  'footer.site-footer',
  'aside.test-notes',
];

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Bundles the harness (the real section, target, and outline code) into one script for the page. */
async function bundleHarness() {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve('src') } },
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve('scripts/sections/harness-entry.ts'), formats: ['iife'], name: 'aiSectionsHarness' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => output.output).find((file) => file.type === 'chunk');
  if (!chunk) throw new Error('Harness bundle is empty');
  return chunk.code;
}

/** The viewport point for a probe, after scrolling its element into the middle of the screen. */
async function pointFor(page, at) {
  return page.evaluate(async (at) => {
    const find = (selector) => {
      const [host, inner] = selector.split(' >>> ');
      const element = document.querySelector(host);
      return inner ? element?.shadowRoot?.querySelector(inner) : element;
    };
    const element = find(typeof at === 'string' ? at : at.gapAbove);
    if (!element) throw new Error(`Nothing matches ${JSON.stringify(at)}`);
    const settle = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    element.scrollIntoView({ block: 'center' });
    await settle();
    if (typeof at === 'string') {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    // Bring the strip above the element to the middle of the screen, even when the element is taller than it.
    window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight / 2);
    await settle();
    const rect = element.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(element).marginTop);
    return { x: rect.left + rect.width / 2, y: rect.top - gap + at.offset };
  }, at);
}

async function main() {
  const server = spawn(process.execPath, ['scripts/serve-fixtures.mjs'], { stdio: 'ignore' });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  let failures = 0;
  let slowest = 0;
  try {
    const harness = await bundleHarness();
    await wait(300);
    for (const width of WIDTHS) {
      console.log(`\n${width} px wide`);
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      await page.goto(PAGE, { waitUntil: 'load' });
      await page.addScriptTag({ content: harness });

      for (const probe of PROBES) {
        if (probe.widths && !probe.widths.includes(width)) continue;
        const { x, y } = await pointFor(page, probe.at);
        const steps = probe.steps ?? 0;
        const result = await page.evaluate(
          (x, y, mode, steps, expected) => window.__aiSections.pick(x, y, mode, steps, expected),
          x,
          y,
          probe.mode,
          steps,
          probe.expect,
        );
        slowest = Math.max(slowest, result.ms);
        if (!result.ok) failures += 1;
        const what = `${probe.mode.padEnd(7)} ${describe(probe.at)}${steps > 0 ? ' ↑' : steps < 0 ? ' ↓' : ''}`;
        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${what.padEnd(44)} → ${result.got}${result.ok ? '' : `   expected ${probe.expect}`}`);
        if (!result.ok) console.log(`       levels: ${result.levels.join(' › ')}`);
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      const outline = await page.evaluate((expected) => window.__aiSections.outline(expected), OUTLINE);
      if (!outline.ok) failures += 1;
      console.log(`  ${outline.ok ? 'ok  ' : 'FAIL'} full page outline (${outline.ms.toFixed(1)} ms): ${outline.got.join(', ')}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`\nSlowest highlight update: ${slowest.toFixed(2)} ms`);
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

function describe(at) {
  return typeof at === 'string' ? at : `gap above ${at.gapAbove}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
