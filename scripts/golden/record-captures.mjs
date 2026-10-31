// Records the golden captures in fixtures/captures/ by driving Chrome through
// fixtures/recording.html with real mouse, click, and scroll input.
// Run with `npm run golden:record`. Chrome runs headless, so no window opens.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { build } from 'vite';

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = 'http://127.0.0.1:5174/recording.html';
const OUT_DIR = resolve('fixtures/captures');

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Bundles the harness (real recorder + snapshot code) into one script for the page. */
async function bundleHarness() {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve('src') } },
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve('scripts/golden/harness-entry.ts'), formats: ['iife'], name: 'aiInteractionHarness' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => output.output).find((file) => file.type === 'chunk');
  if (!chunk) throw new Error('Harness bundle is empty');
  return chunk.code;
}

/** Center of an element on screen, after scrolling it into the middle of the viewport. */
async function center(page, selector, scroll = true) {
  return page.$eval(
    selector,
    (element, shouldScroll) => {
      if (shouldScroll) element.scrollIntoView({ block: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    scroll,
  );
}

async function wheel(page, total, step = 60, pauseMs = 40) {
  const direction = Math.sign(total);
  for (let moved = 0; moved < Math.abs(total); moved += step) {
    await page.mouse.wheel({ deltaY: direction * Math.min(step, Math.abs(total) - moved) });
    await wait(pauseMs);
  }
}

/** Each scenario prepares the page, records one interaction, and returns the capture. */
const scenarios = {
  'hover-card': async (page, record) => {
    const card = await center(page, '.hover-card');
    await page.mouse.move(5, 5);
    return record('.hover-card', async () => {
      await wait(300);
      await page.mouse.move(card.x, card.y, { steps: 6 });
      await wait(900);
      await page.mouse.move(5, card.y, { steps: 6 });
      await wait(900);
    });
  },
  toggle: async (page, record) => {
    const button = await center(page, '.toggle');
    await page.mouse.move(5, 5);
    return record('.toggle', async () => {
      await wait(300);
      await page.mouse.click(button.x, button.y);
      await wait(700);
    });
  },
  'plain-block': async (page, record) => {
    const block = await center(page, '.plain-block');
    await page.mouse.move(5, block.y);
    return record('.plain-block', async () => {
      await wait(200);
      await wheel(page, 300);
      await wait(300);
      await wheel(page, -300);
      await wait(400);
    });
  },
  'scroll-block': async (page, record) => {
    const block = await center(page, '.scroll-block');
    await page.mouse.move(5, block.y);
    return record('.scroll-block', async () => {
      await wait(200);
      await wheel(page, 300);
      await wait(300);
      await wheel(page, -300);
      await wait(400);
    });
  },
  list: async (page, record) => {
    const play = await center(page, '.play');
    await page.mouse.move(play.x + 120, play.y);
    return record('.list', async () => {
      await wait(300);
      await page.mouse.click(play.x, play.y);
      await wait(1300);
    });
  },
  'js-box': async (page, record) => {
    const animate = await center(page, '.animate');
    await page.mouse.move(animate.x + 120, animate.y);
    return record('.js-box', async () => {
      await wait(300);
      await page.mouse.click(animate.x, animate.y);
      await wait(1500);
    });
  },
  reveal: async (page, record) => {
    // Show it once, then scroll it back out of view so it's hidden again.
    await center(page, '.reveal');
    await wait(800);
    await page.evaluate(() => {
      const box = document.querySelector('.reveal');
      const rect = box.getBoundingClientRect();
      window.scrollBy(0, rect.bottom - window.innerHeight - 300);
    });
    await page.mouse.move(5, 5);
    await wait(900);
    return record('.reveal', async () => {
      await wait(200);
      await wheel(page, 500, 40, 50);
      await wait(1200);
    });
  },
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, ['scripts/serve-fixtures.mjs'], { stdio: 'ignore' });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--hide-scrollbars'],
  });
  try {
    const harness = await bundleHarness();
    await mkdir(OUT_DIR, { recursive: true });
    await wait(300);

    for (const [name, scenario] of Object.entries(scenarios)) {
      if (only.length > 0 && !only.includes(name)) continue;
      const page = await browser.newPage();
      await page.goto(PAGE, { waitUntil: 'load' });
      await page.addScriptTag({ content: harness });
      const record = async (selector, act) => {
        await page.evaluate((target) => window.__aiInteractionHarness.start(target), selector);
        await act();
        return page.evaluate(() => window.__aiInteractionHarness.stop());
      };
      const capture = await scenario(page, record);
      await writeFile(resolve(OUT_DIR, `${name}.json`), `${JSON.stringify(capture, null, 2)}\n`);
      const recording = capture.measured.recording;
      console.log(
        `${name.padEnd(13)} ${recording.durationMs} ms · ${recording.frameCount} frames · ${recording.samples.length} samples · ${capture.observed.animations.length} animations`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
