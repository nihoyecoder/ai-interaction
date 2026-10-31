# AI Interaction — Chrome Extension

> See an interaction you love. Capture it. Recreate it with AI.

A Chrome (Manifest V3) extension that captures a web interaction from a live page and turns the evidence (DOM, CSS, animation, event, and geometry data) into an implementation recipe that an AI coding agent such as Claude Code, Codex, or Cursor can follow. It's a tool for understanding interactions. It is **not** a screenshot-to-code or video-to-prompt tool. Accuracy and usefulness for implementation matter more than impressive-sounding descriptions.

## Status

- **M1.1 (scaffold) is done.** The user verified it in Chrome: the side panel opens from the toolbar and live reload works.
- **M1.2 (page connection) is done.** The user verified it in Chrome, in both the dev and production builds.
- **M2.1 (element picker) is done.** The user verified it in Chrome (example.com and a real animation-heavy site). **Next: M2.2, the element snapshot.** Its plan needs to be agreed before any code is written.
- The current side panel UI is a functional placeholder. The user will set the visual direction (design tokens) when the real screens are built, starting in M2.
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
- **The inspector is plain TypeScript.** No React or Tailwind is injected into other people's pages.
- **Vitest 5** (`npm test`) with WXT's `WxtVitest` plugin. Tests sit next to the code as `*.test.ts`. Pure logic, such as `src/core` and the panel's view logic, always gets unit tests.
- **npm** is the package manager. Every version is pinned exactly (`.npmrc` sets `save-exact=true`), and `package-lock.json` is committed.
- **WXT auto-imports are off** (`imports: false`). Import WXT APIs explicitly from `'#imports'`, e.g. `import { browser, defineBackground } from '#imports'`. The path alias `@/` points to `src/`.
- `web-ext` is a dev dependency. `npm run dev` uses it to open Chrome through Chrome's DevTools protocol (`Extensions.loadUnpacked`).
- `npm audit` reports a known low-severity `deepmerge` advisory inside `web-ext`'s dev-only dependency chain. **Don't run `npm audit fix --force`**, because it downgrades `web-ext` to an ancient version.

## Architecture

| Piece | Where it runs | Responsibility |
|---|---|---|
| **Side panel** | Extension page that lives as long as the panel is open | UI, session state machine, orchestration, analysis, recipe, storage |
| **Inspector** | Unlisted script injected on demand into one tab (isolated world) | Highlight overlay, element picking, snapshots, recording raw evidence |
| **Service worker** | Background, short-lived | Minimal: turns a toolbar click into "open the panel". Holds no state. |
| **core** | Imported by the pieces above | Pure TypeScript: evidence types, sanitizing, analysis, recipe generation |

Rules:

- **The side panel orchestrates.** The service worker is not in the data path. Chrome stops it after about 30 seconds of inactivity, so it must never hold recordings or session state.
- **The service worker's only job is toolbar clicks.** It listens on `action.onClicked` and calls `sidePanel.open()` synchronously, while Chrome still counts the call as part of the user's click. It then sends `toolbar-clicked` to the panel so the panel re-checks access. Don't switch back to `setPanelBehavior({ openPanelOnActionClick })`: the click must stay a normal action click so it grants `activeTab` and doesn't close an open panel.
- **Access comes from `activeTab`.** Chrome grants temporary access to a tab when the user clicks our toolbar button. Without access, Chrome hides the tab's URL and title from the extension, so the panel shows a "Give access" state. Verified in Chrome (M1.2, production build):
- Moving the tab to another site removes access, and the panel then shows "Give access".
- Clicking the icon again grants access and keeps the panel open.
- Same-site navigation keeps access, though it ends the session.
- Chrome pages and the Web Store show "can't be inspected".

So the per-site permission fallback isn't needed.
- The inspector is a WXT **unlisted script** (`src/entrypoints/inspector.ts`, built to `/inspector.js`). It's injected with `scripting.executeScript` **only after the user clicks Connect**. Don't make it a WXT content script: `registration: 'runtime'` adds the script's `matches` to `host_permissions`. No content scripts are declared statically, and there is no `<all_urls>` host permission. Injection is idempotent: if a copy is already waiting for the panel, another injection does nothing.
- The side panel and the inspector talk over **one `chrome.tabs.connect` port per session**. Message types are TypeScript discriminated unions in `src/messaging/protocol.ts`. **If the port disconnects (panel closed, Disconnect clicked, page reloaded or navigated, tab closed), the session ends and the inspector removes everything it added.**
- **A capture session belongs to one tab** (product decision, M1.2). On any other tab, the panel offers "Return to [site]" or Disconnect. Which screen to show is decided by the pure function `getPanelView` in `src/panel/panel-view.ts`.
- **Picker and highlight (M2.1).**
  - The highlight is an `<ai-interaction-overlay>` element. It's added to `<html>` only while the user is picking, and removed afterwards.
  - It's shown as a manual popover, in the browser's top layer. Its host styles are inline and `!important`, and its contents sit in a closed shadow root whose `.root` resets styles with `all: initial`. Everything in it has `pointer-events: none`, and it never styles or changes page elements.
  - The picker uses capture listeners on `window`:
    - `pointerdown`, `pointerup`, and `contextmenu` are hidden from the page.
    - `mousedown`, `mouseup`, `click`, `dblclick`, and `auxclick` are hidden from the page and cancelled.
    - Selection happens on `click`, the last event of a press, so no part of the press reaches the page afterwards.
  - Hover, wheel, and scroll events reach the page, so its hover effects and scrolling keep working.
  - The highlight updates at most once per animation frame.
  - Picking stops on Esc (in the page or the panel), Cancel, the tab being hidden, or disconnect.
- `src/core` must not use extension APIs or the live DOM, so it stays unit-testable.
- Entrypoint files in `src/entrypoints/` stay thin. The real logic lives in feature folders.
- Main-world scripts (code that reads page JavaScript such as `window.gsap`) come later and need a deliberate decision. They must be read-only and minimal, and their output is treated as untrusted.

## Folder structure (target)

```
src/
  entrypoints/      thin entry files WXT turns into the extension
    background.ts
    sidepanel/      index.html + main.tsx (mounts the React app)
    inspector.ts    unlisted script; injected on demand, never in the manifest
  panel/            side panel React UI: screens/, components/, hooks/, session/, panel-view.ts
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
- Iframes. The inspector runs only in the top frame, so the picker can't select anything inside an iframe, and clicks inside an iframe still reach it while picking.
- Elements with `pointer-events: none`, which are often decorative layers. They can't be hovered or picked yet.
- Closed shadow roots.
- Restricted pages: `chrome://`, the Chrome Web Store, other extensions, and the PDF viewer. `file://` pages work only if the user opts in.

`fixtures/` holds pages whose true animation values we know. Use them to check whether extraction is accurate.

## Privacy and security (non-negotiable)

- Request the minimum permissions, and add each one only in the milestone that first uses it. Right now the manifest has `sidePanel`, `activeTab`, and `scripting`. `storage` comes when we first store data. Use per-site `optional_host_permissions` only if `activeTab` turns out to be insufficient. **After any config change, run `npm run build` and inspect `.output/chrome-mv3/manifest.json`.** Development builds add `tabs`, `scripting`, and localhost access for hot reload. Those additions are expected, and they aren't in the production build. **Because dev builds have `tabs`, they can see every tab's URL. Always verify access and permission behavior with the production build loaded unpacked, never in `npm run dev`.**
- Nothing runs on a page until the user starts it. Everything stops when the user stops, the panel closes, or the tab navigates away.
- Never capture form values, password fields, `contenteditable` content, cookies, web storage, or network data. Text is capped to short labels.
- Page content is untrusted. Render it only as text (no `dangerouslySetInnerHTML`, no `eval`). In AI prompts, treat it as data, never as instructions.
- Nothing leaves the device without an explicit user action. **Never put API keys in extension code.**
- No remotely hosted code (Chrome Web Store policy). Everything is bundled.
- The inspector must never change the elements it inspects: no outlines, classes, or styles on page nodes. The overlay lives in its own shadow root with `pointer-events: none`.
- While the user is picking, page scripts (session-replay tools, for example) can see the overlay's host element. Its contents are in a closed shadow root, and the element is removed when picking stops.

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
- `npm test` runs the unit tests (Vitest).
- After adding or renaming an entrypoint, run `npx wxt prepare` to regenerate WXT's types, such as the list of valid script paths.
- `npm run zip` creates the Chrome Web Store package.

## Roadmap

- [x] **M1.1** Scaffold WXT + React + TS + Tailwind. The side panel opens from the toolbar icon, and the generated manifest is reviewed.
- [x] **M1.2** Page connection spike: inject into the active tab, round-trip messages over a port, and tear down on close. Also handle unsupported pages and verify the permission model.
- [x] **M2.1** Picker: hover highlight overlay, click to select, Esc to cancel.
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
