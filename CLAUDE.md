# AI Interaction — Chrome Extension

> See an interaction you love. Capture it. Recreate it with AI.

A Chrome (Manifest V3) extension that captures a web interaction from a live page and turns the evidence (DOM, CSS, animation, event, and geometry data) into an implementation recipe that an AI coding agent such as Claude Code, Codex, or Cursor can follow. It's a tool for understanding interactions. It is **not** a screenshot-to-code or video-to-prompt tool. Accuracy and usefulness for implementation matter more than impressive-sounding descriptions.

## Status

- **M1.1 (scaffold) is done.** The user verified it in Chrome: the side panel opens from the toolbar and live reload works.
- **Next: M1.2, the page connection test.** Its plan still needs to be agreed before any code is written.
- The current side panel UI is a placeholder. The user will set the visual direction (design tokens) when the real screens are built, starting in M2.
- Update this section and the roadmap checkboxes whenever a milestone is completed.

## Working agreement

- The user is the product owner. They're a UX/UI and product designer who is new to Chrome extension development. Explain things in plain language. Whenever the user needs to run something, give the exact command and say where to run it (the VS Code terminal at the repo root, which is PowerShell on Windows).
- Work on **one milestone at a time**. Before starting a major feature, explain what you'll build, why, the simplest reliable approach, the browser limitations, and the expected behavior. Then **wait for agreement** before implementing.
- After implementing, explain what changed, give exact steps to run and test it, and help debug before moving on. Recommend a commit after each milestone that works.
- Don't add features, dependencies, or abstractions the user didn't ask for. Don't rewrite working code without a stated reason.
- **Never call something verified because it builds.** "Verified" means it was exercised in Chrome or covered by a passing test. Always say which one.
- When debugging, find the root cause. Don't change several files speculatively.
- Check the current official docs for WXT, Chrome extension APIs, and libraries instead of relying on memory. WXT is pre-1.0, and its APIs can change between minor versions.

## Stack

- **WXT 0.21.5** on Vite, Manifest V3, targeting Chrome only for now. The Side Panel API needs Chrome 114 or later, and we develop on current stable. WXT needs Node 22 or newer.
- **TypeScript 5.9** in strict mode, which includes `noUncheckedIndexedAccess`. TS 7 is a native rewrite, so upgrade it deliberately and only after WXT supports it.
- **React 19 + Tailwind CSS v4** (through `@tailwindcss/vite`), used in the **side panel only**.
- **The inspector content script is plain TypeScript.** No React or Tailwind is injected into other people's pages.
- **Vitest** for unit tests of `src/core`. Add it with the first piece of pure logic, not before.
- **npm** is the package manager. Every version is pinned exactly (`.npmrc` sets `save-exact=true`), and `package-lock.json` is committed.
- **WXT auto-imports are off** (`imports: false`). Import WXT APIs explicitly from `'#imports'`, e.g. `import { browser, defineBackground } from '#imports'`. The path alias `@/` points to `src/`.
- `web-ext` is a dev dependency. `npm run dev` uses it to open Chrome through Chrome's DevTools protocol (`Extensions.loadUnpacked`).
- `npm audit` reports a known low-severity `deepmerge` advisory inside `web-ext`'s dev-only dependency chain. **Don't run `npm audit fix --force`**, because it downgrades `web-ext` to an ancient version.

## Architecture

| Piece | Where it runs | Responsibility |
|---|---|---|
| **Side panel** | Extension page that lives as long as the panel is open | UI, session state machine, orchestration, analysis, recipe, storage |
| **Inspector** | Content script injected on demand into one tab (isolated world) | Highlight overlay, element picking, snapshots, recording raw evidence |
| **Service worker** | Background, short-lived | Minimal: sets up "toolbar click opens the panel". Holds no state. |
| **core** | Imported by the pieces above | Pure TypeScript: evidence types, sanitizing, analysis, recipe generation |

Rules:

- **The side panel orchestrates.** The service worker is not in the data path. Chrome stops it after about 30 seconds of inactivity, so it must never hold recordings or session state.
- The inspector is injected with `chrome.scripting.executeScript`, and **only after a user action**. No content scripts are declared statically, and there is no `<all_urls>` host permission. Injection must be idempotent, so injecting twice is harmless.
- The side panel and the inspector talk over **one `chrome.tabs.connect` port per session**. Message types are a TypeScript discriminated union defined in `src/messaging/`. **If the port disconnects (panel closed, tab navigated, or reload), both sides tear down completely.**
- A capture session belongs to **one tab**.
- `src/core` must not use extension APIs or the live DOM, so it stays unit-testable.
- Entrypoint files in `src/entrypoints/` stay thin. The real logic lives in feature folders.
- Main-world scripts (code that reads page JavaScript such as `window.gsap`) come later and need a deliberate decision. They must be read-only and minimal, and their output is treated as untrusted.

## Folder structure (target)

```
src/
  entrypoints/      thin entry files WXT turns into the extension
    background.ts
    sidepanel/      index.html + main.tsx (mounts the React app)
    inspector.content.ts
  panel/            side panel React UI: screens/, components/, session/
  inspector/        runs inside the web page (plain TS): overlay, picker, snapshot, recorder/
  core/             pure logic + tests: evidence types, privacy, analysis/, recipe/
  messaging/        typed message contracts shared by panel + inspector
  storage/          chrome.storage wrappers (settings, recent captures)
fixtures/           local test pages with known interaction values (ground truth)
public/icon/        extension icons (WXT placeholders; to be replaced with our own design)
```

## Evidence and accuracy

Every fact in the evidence and in the recipe carries one of these labels:

- **Observed**: read directly from the browser, such as computed styles, `getAnimations()` timing, easing, and keyframes, DOM structure, or events.
- **Measured**: derived from sampled data, such as position, transform, or opacity over time.
- **Estimated**: inferred from measurements, such as an easing curve fit, a likely trigger, or a spring approximation.
- **Recommended**: an implementation suggestion such as a library or code approach, whether from a template or from AI.

Never present something Estimated or Recommended as Observed. When we can't tell, the output must say so.

Known blind spots, which the UI and the recipes must communicate honestly:

- Animations driven by JavaScript (GSAP, `requestAnimationFrame` loops, most spring animations) can only be Measured, not Observed.
- Canvas and WebGL content.
- Cross-origin iframes.
- Closed shadow roots.
- Restricted pages: `chrome://`, the Chrome Web Store, other extensions, and the PDF viewer. `file://` pages work only if the user opts in.

`fixtures/` holds pages whose true animation values we know. Use them to check whether extraction is accurate.

## Privacy and security (non-negotiable)

- Request the minimum permissions, and add each one only in the milestone that first uses it. Right now the manifest has only `sidePanel`. The planned set is `sidePanel`, `activeTab`, `scripting`, and `storage`. Use per-site `optional_host_permissions` only if `activeTab` turns out to be insufficient. **After any config change, run `npm run build` and inspect `.output/chrome-mv3/manifest.json`.** Development builds add `tabs`, `scripting`, and localhost access for hot reload. Those additions are expected, and they aren't in the production build.
- Nothing runs on a page until the user starts it. Everything stops when the user stops, the panel closes, or the tab navigates away.
- Never capture form values, password fields, `contenteditable` content, cookies, web storage, or network data. Text is capped to short labels.
- Page content is untrusted. Render it only as text (no `dangerouslySetInnerHTML`, no `eval`). In AI prompts, treat it as data, never as instructions.
- Nothing leaves the device without an explicit user action. **Never put API keys in extension code.**
- No remotely hosted code (Chrome Web Store policy). Everything is bundled.
- The inspector must never change the elements it inspects: no outlines, classes, or styles on page nodes. The overlay lives in its own shadow root with `pointer-events: none`.

## Inspector performance rules

- Use passive listeners, and throttle pointer and scroll handling to animation frames.
- Sample only the selected element plus a capped number of descendants. Cap recordings at 10 seconds by default, and store only values that changed.
- Don't write to the DOM during sampling, except for our own overlay.
- Every listener, observer, timer, and `requestAnimationFrame` loop has a matching teardown.

## Design and UX

- Polished, minimal, and calm, with no cluttered DevTools look.
- Every screen state is designed: empty, unsupported page, needs permission, selecting, selected, recording, analyzing, result, and error.
- Accessible: everything is reachable by keyboard, focus is visible, controls are labeled, contrast is sufficient, and reduced-motion preferences are respected.
- Layouts work at both narrow and wide side panel widths.

## Commands

Run these from the repo root:

- `npm run dev` starts the dev server and opens a fresh Chrome profile with the extension and hot reload. Chrome shows an "unsupported command-line flag: --disable-blink-features=AutomationControlled" banner. That's expected: `web-ext` adds the flag so sites with bot detection behave normally.
- `npm run build` creates a production build in `.output/chrome-mv3`.
- `npm run compile` runs the TypeScript type check.
- `npm run zip` creates the Chrome Web Store package.

## Roadmap

- [x] **M1.1** Scaffold WXT + React + TS + Tailwind. The side panel opens from the toolbar icon, and the generated manifest is reviewed.
- [ ] **M1.2** Page connection spike: inject into the active tab, round-trip messages over a port, and tear down on close. Also handle unsupported pages and verify the permission model.
- [ ] **M2.1** Picker: hover highlight overlay, click to select, Esc to cancel.
- [ ] **M2.2** Element snapshot: DOM path, curated computed styles, a clean inspector card, re-select and clear.
- [ ] **M3.1** Recorder: start and stop with a time cap, plus event telemetry and frame sampling of geometry, transform, and opacity.
- [ ] **M3.2** Animation evidence: `getAnimations()`, transition and animation events, and class and style mutations.
- [ ] **M3.3** Evidence model plus a simple timeline view and a JSON export for debugging.
- [ ] **M4** Analysis in `core` (triggers, timing, easing fit, stagger), unit-tested against `fixtures/`.
- [ ] **M5.1** Deterministic recipe, copyable, for one narrow target stack.
- [ ] **M5.2** Compare our recipe with a plain "recording + prompt" baseline. Then decide whether an AI step adds value.
- [ ] **M5.3** (Only if M5.2 justifies it) AI-enhanced recipe through a secure backend.
- [ ] **M6** Test on real sites, then performance, accessibility, polish, and Web Store readiness.

## Scope

- **Not in V1:** authentication, payments, a marketplace, community features, full website cloning, deployment, broad framework support, complex cloud infrastructure, and promises of pixel-perfect recreation.
- **Later, by decision only:** tab video capture (needs `tabCapture` plus an offscreen document), main-world library detection, and "Adapt to My Project".
