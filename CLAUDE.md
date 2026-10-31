# AI Interaction — Chrome Extension

> See an interaction you love. Capture it. Recreate it with AI.

A Chrome (Manifest V3) extension that captures a web interaction from a live page and turns the evidence (DOM, CSS, animation, event, and geometry data) into an implementation recipe that an AI coding agent such as Claude Code, Codex, or Cursor can follow. It's a tool for understanding interactions. It is **not** a screenshot-to-code or video-to-prompt tool. Accuracy and usefulness for implementation matter more than impressive-sounding descriptions.

## Status

- **M1.1 (scaffold) is done.** The user verified it in Chrome: the side panel opens from the toolbar and live reload works.
- **M1.2 (page connection) is done.** The user verified it in Chrome, in both the dev and production builds.
- **M2.1 (element picker) is done.** The user verified it in Chrome, on example.com and on a real animation-heavy site.
- **M2.2 (element details card) is done.** The user verified it in Chrome against `fixtures/style-snapshot.html` (all expected values matched). Phase 2 is complete.
- **M3.1 (recorder) is done.** The user verified it in Chrome against `fixtures/recording.html`, including the auto-stop and leaving the tab.
- **M3.2 (animation evidence) is done.** The user verified it in Chrome against `fixtures/recording.html` (sections 1–4 and 6).
- **M3.3 (evidence package, timeline, export) is done.** The user verified it in Chrome (no screenshot of the timeline yet). Phase 3 is complete.
- Product decisions for Phase 4:
  - It's split into **M4.1** (trigger, motion, stagger) and **M4.2** (easing fit).
  - The user's exported captures from the test pages become golden tests in `fixtures/captures/`.
- **M4.1 (analysis: trigger, motion, stagger) is done.** It's verified on **real Chrome recordings, made automatically** (`npm run golden:record`, 7 golden tests, stable across 3 fresh recordings). The user asked for this automation instead of testing by hand. **Not yet seen by a person:** the Analysis card's layout in the panel, and the Download JSON button (its M3.3 check may also have been skipped). Ask the user to glance at both during the next manual test. **Next: M4.2, easing fit.** Its plan needs to be agreed before any code is written.
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
- `npm audit` reports known advisories in dev-only tooling, none of which ships in the extension:
  - low severity: `deepmerge`, inside `web-ext`
  - moderate severity: `minimatch`, inside the ESLint packages that come with `wxt` and `web-ext`

  **Don't run `npm audit fix --force`**, because it downgrades core tools.
- `puppeteer-core` is a dev dependency, used only by `scripts/golden/` to drive the installed Chrome. It downloads no browser.

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
- **Element details (M2.2).**
  - The inspector reads a snapshot once per selection (`src/inspector/snapshot.ts`): name, path, size before and after transforms, page position, and the computed styles in `SNAPSHOT_PROPERTIES`. It only reads. Page values are capped in `createElementSnapshot`.
  - "Only non-default styles" (a product decision) means compared with **Chrome's built-in defaults for that kind of element**. The panel reads those from an unstyled copy of the same tag, created in a closed shadow root in the side panel (`src/panel/default-styles.ts`), never on the page.
  - The default for transform origin depends on size: center for HTML elements and an outer `<svg>`, 0 0 for SVG elements inside an `<svg>`.
  - Transitions and animations are judged by meaning: "all 0s" means no transition, and animation-name "none" means no animation.
  - A transform is decoded from Chrome's `matrix()` into translate · rotate · skewX · scale (`src/core/transform.ts`). That's one equivalent way to write it, so the raw matrix is always shown beside it. `matrix3d` isn't decoded yet.
  - Parent/Child: "Child" first goes back down the way the user came up, otherwise to the first visible child. Each step flashes the highlight for 1.5 s.
  - **Never scroll the page programmatically.** Scrolling can trigger the site's own scroll animations.
- **Recorder (M3.1).**
  - Product decisions: recording starts immediately when the user clicks Record, and a "● Recording" pill shows in the page's bottom-right corner.
  - **Nothing is blocked while recording.** The page works normally. Listeners are passive, and they record only times, coordinates, and sizes. They never record keystrokes, form values, or page text.
  - Each animation frame (`src/inspector/recorder.ts`) reads the following, storing only what changed since the previous frame:
    - the box, `transform`, and `opacity` of the selected element and up to 20 descendants that have a box, closest levels first, sized before transforms
    - page scroll, and the scroll of up to 10 other scrolling areas
    - the pointer position
    - the selected element's `:hover` state, read from Chrome's own state rather than guessed from coordinates
  - Presses (`pointerdown` and `pointerup`) are timestamped with `event.timeStamp`.
  - Recording stops on Stop, at the 10 s limit, or when the tab is hidden (the result is still delivered). It's discarded if the session ends or the selection changes.
  - Recordings live in panel memory only. Nothing is stored or sent.
  - `summarizeRecording` (`src/core/recording-summary.ts`) decides whether an element "changed on its own". Changes in transform, opacity, or size count. Movement counts only if it's neither zero (fixed or sticky elements) nor exactly the opposite of the page scroll (normal flow). Scrolling inside nested scroll areas still counts as movement for now.
  - The highlight and the pill share `createTopLayer` (`src/inspector/layer.ts`).
- **Animation evidence (M3.2).**
  - Each frame of a recording also checks `selected.getAnimations({ subtree: true })`. That covers inner elements beyond the 20 tracked ones, and pseudo-elements. Each new animation is noted once (`src/inspector/animations.ts`) with its kind (CSS transition, CSS animation, or Web Animation), name, timing, keyframes, whether it's scroll-driven (it doesn't run on the document timeline), and whether it was already running at the start.
  - CSS animations report "linear" timing and put their easing on the keyframes. The evidence uses the first keyframe's easing in that case.
  - A `MutationObserver` on the selected element (subtree, attributes, old values) records three things, capped:
    - class names added or removed (`diffClasses`)
    - other attributes' **names only, never values**
    - inline-style change **counts only**
  - `describeEvidence` (`src/core/recording-evidence.ts`) turns these into lines labeled Observed or Estimated. "JavaScript is animating it" is Estimated, and appears at 10 or more inline-style changes.
  - Product decision: detecting animation libraries in the page's main world (GSAP, Framer Motion, Lenis) is deferred.
- **Evidence package, timeline, and export (M3.3).**
  - `createCapture` (`src/core/capture.ts`) builds the single versioned package that analysis (Phase 4) and recipes (Phase 5) read. It has `format: 'ai-interaction/capture'` and `version: 1`, so **bump the version on breaking changes**. Facts are grouped by how we know them:
    - `observed`: the element snapshot, animations, and class, attribute, and style-write evidence
    - `measured`: the recording samples and their summary
    - `estimated`: only the Estimated evidence lines
  - Product decision: the page is identified by **hostname only**, never the full URL. The package contains no page text.
  - `buildTimeline` (`src/core/timeline.ts`) turns a recording into rows in three groups:
    - **actions:** hover spans, presses, scroll activity
    - **changes:** the element, plus up to 5 inner elements
    - **evidence:** class-change points, plus up to 6 animation bars showing their delay, or drawn as "ongoing" when running at the start or scroll-driven
    It shares `changeTimesByElement` with the summary, so the two always agree.
  - The timeline sits inside the recording card, between the summary sentences and the Evidence list (a product decision). `Timeline.tsx` follows the dataviz skill:
    - colors: categorical slots 1–3, validated with `validate_palette.js` against `#ffffff` and `#0a0a0a`
    - every row has a text label
    - marks: 8 px rounded bars, and 8 px dots with a surface ring and a 24 px hit area
    - solid hairline gridlines
    - tooltips on hover and on keyboard focus
    - a "Timeline as a list" view, because light-mode green is below 3:1 contrast
  - Export (`ExportControls.tsx`) offers Copy JSON (clipboard) and Download JSON (a blob link). It needs no permissions.
- **Analysis (M4.1)**, in `src/core/analysis/`. `analyzeCapture(capture)` is a pure function of the capture.
  - **Segments** (`segments.ts`): each element's changed frames, using `changedOnItsOwn`, split wherever there's a gap of more than 100 ms. "From" is the resting state just before the first changed frame.
  - **Values** (`values.ts`): changes are read from decoded transforms and opacity. Box movement and resizing count only when no transform changed, because transforms move the box too. Positions are in page coordinates.
  - **Instant jumps** at the start (a delayed CSS animation applying its first keyframe) and at the end (a script resetting the element) are detected when one step is more than 4× the next. They're reported as `jumpedFrom` and `jumpedTo`.
  - **Followers:** inner elements whose only change is box movement, at the same time as a shallower element's transform, size change, or scroll link, are counted rather than listed.
  - An instant segment explained by the same animation as a later motion is dropped. It's that animation's first keyframe.
  - **Causes** (`causes.ts`): look back from the moment Chrome created the explaining animation, or from the first changed frame if there's none.
    - The chain is: user action (hover start or end, press, click, viewport entry), then optionally a class change on the element or the selected root, then the motion.
    - Windows: 300 ms for actions, 1000 ms for viewport entries.
    - Without any action, the trigger is "scroll" if the page scrolled within 150 ms, otherwise "none".
    - Triggers are always **Estimated**, with a confidence: high when the action is within about 50 ms and the mechanism is known.
  - **Mechanism:** the explaining animation's kind (Observed). Otherwise "javascript" when the element's inline style changed (Estimated). Otherwise "unknown".
  - **Scroll links** (`scroll-links.ts`) need all of the following:
    - at least 6 samples and at least 30 px of scrolling
    - 90% of the changes happening in frames where the page scrolled
    - a correlation of at least 0.95 with the scroll position (0.8 for scroll-driven CSS animations)
    - no time-based animation from Chrome on that element

    A scroll-linked element's segments aren't listed separately.
  - **Stagger** (`stagger.ts`) requires at least 3 siblings, taken from the depth with the most moving elements. It uses observed `animation.t + delay` when available, otherwise measured starts. Gaps must be steady: at most 15% of the median, or 5 ms for observed and 2 frames for measured.
  - `describe.ts` holds all wording: the headline, causes, and property changes. The UI is `AnalysisCard.tsx`, above the recording card.
  - `decodeTransform` also decodes a flat `matrix3d` (GSAP's `translate3d(x, y, 0)`).
  - Hover and viewport changes are only noticed at the next frame, while presses carry exact event times. So when choosing the most recent action, hover and viewport times are moved back by one frame, and a click wins a tie. A real recording caught this: a quick move-and-click was read as a hover.
- **Golden tests: real recordings.**
  - `npm run golden:record` (`scripts/golden/record-captures.mjs`):
    - bundles `scripts/golden/harness-entry.ts`, which is the real snapshot, recorder, and capture code
    - opens `fixtures/recording.html` in headless installed Chrome through `puppeteer-core`
    - performs each interaction with real mouse, click, and wheel input
    - writes `fixtures/captures/*.json`
  - `src/core/analysis/golden.test.ts` checks meanings, not exact milliseconds, so re-recording doesn't break it.
  - **Re-record and re-run the tests after changing the recorder or the analysis.** When adding an interaction type, add a fixture section, a scenario, and a golden test.
  - The harness skips the side panel and the extension shell. Those still need a person in Chrome.
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
  core/             pure logic + tests: evidence, capture, timeline, analysis/ (M4), recipe/ (M5)
  messaging/        typed message contracts shared by panel + inspector
  storage/          chrome.storage wrappers (settings, recent captures)
fixtures/           local test pages with known values, each listing what the extension should report (`npm run fixtures`)
scripts/            dev tooling, e.g. serve-fixtures.mjs (no dependencies, local only)
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
- Elements with `pointer-events: none`, which are often decorative layers. They can't be hovered or picked yet, though ↓ Child can reach them.
- Recording: elements that start with `display: none` and appear later aren't tracked. Hidden tabs pause frame timing, so leaving the tab stops a recording. A transition that starts and ends between two frames (under about 16 ms) can be missed. JavaScript libraries' own settings (GSAP timelines, for example) are invisible: only their effects are recorded.
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
- `npm run fixtures` serves `fixtures/` at http://127.0.0.1:5174 (local only). Run it in a second terminal next to `npm run dev`.
- `npm run golden:record` re-records `fixtures/captures/*.json` in headless Chrome (no window). Pass scenario names to record only some of them, e.g. `npm run golden:record -- toggle reveal`.
- After adding or renaming an entrypoint, run `npx wxt prepare` to regenerate WXT's types, such as the list of valid script paths.
- `npm run zip` creates the Chrome Web Store package.

## Roadmap

- [x] **M1.1** Scaffold WXT + React + TS + Tailwind. The side panel opens from the toolbar icon, and the generated manifest is reviewed.
- [x] **M1.2** Page connection spike: inject into the active tab, round-trip messages over a port, and tear down on close. Also handle unsupported pages and verify the permission model.
- [x] **M2.1** Picker: hover highlight overlay, click to select, Esc to cancel.
- [x] **M2.2** Element snapshot: DOM path, curated computed styles, a clean inspector card, re-select and clear.
- [x] **M3.1** Recorder: start and stop with a time cap, plus event telemetry and frame sampling of geometry, transform, and opacity.
- [x] **M3.2** Animation evidence: `getAnimations()`, transition and animation events, and class and style mutations.
- [x] **M3.3** Evidence model plus a simple timeline view and a JSON export for debugging.
- [x] **M4.1** Analysis in `core`: trigger, motion segments, scroll links, stagger. Golden-tested on real Chrome recordings.
- [ ] **M4.2** Easing fit for measured (JavaScript-driven) motion.
- [ ] **M5.1** Deterministic recipe, copyable, for one narrow target stack.
- [ ] **M5.2** Compare our recipe with a plain "recording + prompt" baseline. Then decide whether an AI step adds value.
- [ ] **M5.3** (Only if M5.2 justifies it) AI-enhanced recipe through a secure backend.
- [ ] **M6** Test on real sites, then performance, accessibility, polish, and Web Store readiness.

## Scope

- **Not in V1:** authentication, payments, a marketplace, community features, full website cloning, deployment, broad framework support, complex cloud infrastructure, and promises of pixel-perfect recreation.
- **Later, by decision only:** tab video capture (needs `tabCapture` plus an offscreen document), main-world library detection, and "Adapt to My Project".
