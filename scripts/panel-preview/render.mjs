// Screenshots side panel screens with sample data, in light and dark mode, at side panel width.
// Usage: npm run preview:panel -- [screen names]   (default: all of home design picking section page)
// Screenshots go to .output/panel-preview/.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { build, preview } from 'vite';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = resolve('.output/panel-preview');
const SCREENS = ['home', 'design', 'picking', 'section', 'page'];
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : SCREENS;

await build({
  configFile: false,
  logLevel: 'warn',
  root: resolve('scripts/panel-preview'),
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve('src') } },
  build: { outDir: resolve(OUT, 'site'), emptyOutDir: true },
});

await mkdir(OUT, { recursive: true });
// Module scripts don't load from file:// URLs, so serve the built page over HTTP.
const server = await preview({
  configFile: false,
  logLevel: 'warn',
  root: resolve('scripts/panel-preview'),
  build: { outDir: resolve(OUT, 'site') },
  preview: { port: 5175, host: '127.0.0.1', strictPort: true },
});
const url = 'http://127.0.0.1:5175/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  for (const name of names) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage();
      page.on('pageerror', (error) => console.error(`[${name}] page error:`, error.message));
      await page.setViewport({ width: 380, height: 760, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await page.evaluateOnNewDocument(`window.__screen = ${JSON.stringify(name)};`);
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('main section', { timeout: 10000 });
      const file = resolve(OUT, `${name}-${scheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
