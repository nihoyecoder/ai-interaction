# AI Interaction

> See an interaction you love. Capture it. Recreate it with AI.

AI Interaction is a Chrome extension (Manifest V3) that captures web interactions and turns them into implementation recipes for AI coding agents. Project conventions, architecture, and the roadmap are in [CLAUDE.md](CLAUDE.md).

## Requirements

- Node.js 22 or newer (developed on 24), plus npm
- Google Chrome

## Setup

Run this once, in a terminal at the project root:

```
npm install
```

## Develop

```
npm run dev
```

This starts a development server and opens a separate Chrome window with a fresh profile and the extension installed. The extension reloads automatically when the code changes. Press `Ctrl+C` in the terminal to stop.

To open the extension, click the puzzle-piece **Extensions** icon in Chrome's toolbar, then click **AI Interaction**. Pin it there to get one-click access.

Notes:

- Development builds include extra permissions that WXT uses for hot reload: `tabs`, `scripting`, and access to the local dev server. Production builds don't include them. To see the real permission set, check `.output/chrome-mv3/manifest.json` after running `npm run build`. One effect: the dev build can see every tab's address, so test anything about page access with the production build (see below).
- The Chrome window opened by `npm run dev` shows a banner saying "You are using an unsupported command-line flag: --disable-blink-features=AutomationControlled". This is expected and you can dismiss it. `web-ext` adds the flag so websites don't treat the dev browser as a bot. It applies only to this throwaway profile, never to your normal Chrome.

### Load into your normal Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. After each rebuild, click the reload icon on the extension's card.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server and opens Chrome with live reload |
| `npm run build` | Creates a production build in `.output/chrome-mv3` |
| `npm run compile` | Runs the TypeScript type check |
| `npm test` | Runs the unit tests |
| `npm run fixtures` | Serves the local test pages at http://127.0.0.1:5174 |
| `npm run golden:record` | Re-records the real test captures in hidden Chrome, for the analysis tests |

## Test pages

The `fixtures/` folder holds small local pages with known styles and interactions. Each page lists what the extension should report, so you can check its accuracy. To use them, run `npm run fixtures` in a second terminal and open http://127.0.0.1:5174.
| `npm run zip` | Creates a zip ready for the Chrome Web Store |
