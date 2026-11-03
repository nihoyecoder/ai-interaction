# AI Interaction — Chrome Extension

> See an interaction you love. Capture it. Recreate it with AI.

A Chrome (Manifest V3) extension that turns what the user sees on a live page into a prompt for an AI coding agent such as Claude Code, Codex, or Cursor. It has two separate workflows (product decision, 2026-11-02):

- **Select Design:** the user picks an Element, a Section, or the Full page. The extension reads design evidence from the page (structure, computed styles, a screenshot) and builds a prompt to create something **similar**, not a verbatim copy of someone else's site or brand assets.
- **Record Motion:** the user records a real video of the tab, 5 seconds at most. An AI analyzes the video (or timestamped frames) through a backend that holds the API key, and writes a prompt to recreate the motion.

The first screen offers only these two choices, and each reveals only the controls it needs. Both end on the same prompt screen (Copy, Regenerate, React or HTML/CSS). Accuracy and honesty matter more than impressive-sounding descriptions: facts read from the page are always kept apart from interpretation.

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
- **M4.1 (analysis: trigger, motion, stagger) is done.** It's verified on **real Chrome recordings, made automatically** (`npm run golden:record`, 7 golden tests, stable across 3 fresh recordings). The user asked for this automation instead of testing by hand. **Not yet seen by a person:** the Analysis card's layout in the panel, and the Download JSON button (its M3.3 check may also have been skipped). Ask the user to glance at both during the next manual test.
- **M4.2 (easing fit) is done.** It's verified on real Chrome recordings of 7 known JavaScript easings (fixture section 8). All 14 golden tests are stable across 3 fresh recordings. Product decision: when nothing fits, say so honestly and give the closest custom cubic-bezier. Phase 4 is complete.
- **M5.1 (recipe) is done.** Product decision: the first target is **React + GSAP, using plain CSS where CSS is enough**.
  - Verified:
    - recipe tests on all 15 real captures
    - panel screenshots of real components with real data (`npm run preview:panel`), reviewed in light and dark mode
  - Not yet done: a person pasting a recipe into Claude Code. That's M5.2.
- **Product redirect (2026-11-02).** The user redefined the product as the two workflows above. Review outcome, agreed with the user:
  - Kept: the toolbar and `activeTab` access model, page support, injection and cleanup, the top-layer highlight, the picker, and the panel building blocks.
  - **The old element-recording flow (M3–M5: recorder, analysis, recipe, timeline, JSON export) is dormant.** It's out of the UI and out of the built extension, but its code stays, with its unit and golden tests. It may give Record Motion exact facts that a video can't (for example a CSS transition's duration and easing). If Record Motion doesn't use it, delete it then.
  - The Connect step is gone: choosing Select Design is the explicit action that injects the inspector.
- **M6.1 (home screen and Select Design selection) is built, not yet tested by a person.**
  - Verified by tests: unit tests (`src/core/sections.test.ts` covers 18 page patterns plus Element mode and the Full page outline; `panel-view.test.ts`), and `npm run sections:check`, which runs the real code in headless Chrome on `fixtures/sections.html` at 1280, 1000, and 390 px wide. All pass. The slowest highlight update measured 2.3 ms.
  - Screens reviewed as screenshots (`npm run preview:panel`), light and dark.
  - **Waiting for:** the user's manual test in Chrome with the production build, on `fixtures/sections.html` and 2–3 real sites.
- **M5.2 (recipe vs. baseline comparison) is on hold**, because it compared the old recipe. The lab can test the new prompts later.
  - **The lab** is `D:\ai-interaction-lab`, its own Git repo. It's deliberately outside this repo, so Claude Code doesn't load this `CLAUDE.md` during the test.
    - React + GSAP, with three experiment slots, each with A (recipe) and B (baseline)
    - an A/B switcher at http://localhost:5173
    - a step-by-step `README.md`, a `SCORECARD.md`, and a neutral `CLAUDE.md` shared by both versions
  - **The baseline (B)** is a short description in the user's own words, two screenshots, and the link. Claude Code can't watch video.
  - **Order: B is built before A**, so the recipe's numbers can't leak into the description.
  - **Waiting for:** the user to pick 2–3 interactions. Suggested: a Stripe or Linear hover, an Apple or Framer reveal on scroll, and an Apple or Awwwards scroll-linked effect.
  - **Then:** fill in the experiments' titles and links in the lab's `src/experiments/registry.ts`, and help the user run the test.
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
| **Side panel** | Extension page that lives as long as the panel is open | UI, session state machine, orchestration, prompt generation, storage |
| **Inspector** | Unlisted script injected on demand into one tab (isolated world) | Highlight overlay, picking elements and sections, reading what's selected |
| **Service worker** | Background, short-lived | Minimal: turns a toolbar click into "open the panel". Holds no state. |
| **core** | Imported by the pieces above | Pure TypeScript: section rules, selection and evidence types, sanitizing, prompt generation |

Rules:

- **The side panel orchestrates.** The service worker is not in the data path. Chrome stops it after about 30 seconds of inactivity, so it must never hold recordings or session state.
- **The service worker's only job is toolbar clicks.** It listens on `action.onClicked` and calls `sidePanel.open()` synchronously, while Chrome still counts the call as part of the user's click. It then sends `toolbar-clicked` to the panel so the panel re-checks access. Don't switch back to `setPanelBehavior({ openPanelOnActionClick })`: the click must stay a normal action click so it grants `activeTab` and doesn't close an open panel.
- **Access comes from `activeTab`.** Chrome grants temporary access to a tab when the user clicks our toolbar button. Without access, Chrome hides the tab's URL and title from the extension, so the panel shows a "Give access" state. Verified in Chrome (M1.2, production build):
- Moving the tab to another site removes access, and the panel then shows "Give access".
- Clicking the icon again grants access and keeps the panel open.
- Same-site navigation keeps access, though it ends the session.
- Chrome pages and the Web Store show "can't be inspected".

So the per-site permission fallback isn't needed.
- The inspector is a WXT **unlisted script** (`src/entrypoints/inspector.ts`, built to `/inspector.js`). It's injected with `scripting.executeScript` **only after the user chooses Select Design**. Don't make it a WXT content script: `registration: 'runtime'` adds the script's `matches` to `host_permissions`. No content scripts are declared statically, and there is no `<all_urls>` host permission. Injection is idempotent: if a copy is already waiting for the panel, another injection does nothing.
- The side panel and the inspector talk over **one `chrome.tabs.connect` port per session**. Message types are TypeScript discriminated unions in `src/messaging/protocol.ts`. **If the port disconnects (panel closed, Back to the home screen, End session, page reloaded or navigated, tab closed), the session ends and the inspector removes everything it added.**
- **A capture session belongs to one tab** (product decision, M1.2). On any other tab, the panel offers "Return to [site]" or End session. Which screen to show is decided by the pure function `getPanelView` in `src/panel/panel-view.ts`.
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
  - **Keyboard focus usually stays in the side panel while the user picks**, because they clicked a panel button to start. So the panel listens for Esc, ↑, and ↓ (`useKeys`) and forwards them (`picker:cancel`, `picker:widen`, `picker:narrow`). The picker also handles them if the page has focus, and hides them from the page so it doesn't scroll.
- **Select Design (M6.1).**
  - **Screens:** home (Select Design, plus Record Motion marked "Coming soon") → Element / Section / Full page → picking → selected. Back goes one level up: from a selection to the three choices, and from there to home, which disconnects and cleans up the page.
  - **Levels for ↑ and ↓** (`src/core/sections.ts`): the hovered element and its ancestors, grouped so that elements with the same visible box (clipped by ancestors that hide overflow) are one level. So every key press visibly changes the highlight. A level is named after its outermost sectioning element, otherwise its outermost element. Inline elements other than the starting one, and levels that are the whole page, aren't levels. The whole page is Full page's job.
  - **Element mode** starts at the hovered element. Anything inside an `<svg>` starts at the outermost `<svg>`.
  - **Section mode** starts at the hovered element's section. Walking down from just below `<body>` (or from the outermost fixed or top-layer element), the section is the first element that isn't a **page wrapper**. Wrappers are recognized by shape, because many sites use plain divs:
    - several blocks stacked vertically, flush with the element: sections have padding, page wrappers don't
    - on long pages, a page-scale element holding several big blocks, whatever their width
    - page-tall columns side by side (docs sidebars, app shells)
    - a wrapper around a wrapper (framework roots such as `#root` or `#__next`)
    - a full-width bar floating over a page-sized block, or a screen-sized modal backdrop around a smaller panel

    Sectioning tags and landmark roles are one section unless they hold at least two sectioning elements. When the pointer is on a wrapper itself (between sections), it snaps to the nearest section. The rules came from research with 14 real page patterns. Removing any rule breaks at least one of them. Four more patterns were added later (GSAP ScrollSmoother, Headless UI modals, pinned scroll-telling sections, bento pages).
  - **Full page** (`pageOutline`) opens every page wrapper from `<body>` down and lists the rest in DOM order, which survives sticky headers that move while scrolling. Absolute children are left out unless they're a bar across the top, and small fixed buttons (such as chat bubbles) are left out too.
  - **After selecting:** Wider (`widerThan`, the next level up) and Narrower (back down the Wider trail, otherwise the first in-flow child with a different box; never inside an `<svg>`). Each step flashes the highlight. The selection (`src/core/selection.ts`) holds only names, sizes, the ancestor path, and the page and viewport size, with no page text.
  - The inspector reads the chain (`src/inspector/section-input.ts`) only when it updates the highlight: the hovered element, its ancestors, and their children's boxes (at most 100 children each).
  - `npm run sections:check` (`scripts/sections/`) bundles the real code into `fixtures/sections.html` in headless Chrome, hovers known points at three widths, and checks the highlight, ↑ and ↓, and the outline. **Run it after changing the section rules, the picker, or the test page.** When a real site picks the wrong section, add its shape to `sections.test.ts` first.
- **Dormant since M6.1: element details and the element-recording flow (M2.2–M5.1, below).** None of it is in the UI or the built extension. The golden harness and the unit tests still use it, so it keeps working.
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
- **Easing fit (M4.2)** (`src/core/analysis/easing.ts`). It runs only for motions with no explaining animation from Chrome, because Chrome's easing is exact.
  - The progress curve comes from the most telling changed property (`EASING_PROPERTIES` order). A reset jump at the end is excluded.
  - **Candidates:**
    - CSS keywords, listed first so they win ties
    - GSAP power1–4, sine, expo, circ, back, elastic, and bounce, using their real formulas, with the usual cubic-bezier approximation as `css`
    - underdamped springs: a coarse grid, then the best one refined
  - **Timing is fitted too.** The true start lies before the first point that **actually moved**, which skips reset frames. The true end can lie after the last visible change, for long tails. Both are searched by seeded coordinate descent down to 0.25 ms. A fixed grid stepped over elastic's narrow optimum.
  - **Quality:** close is 2% RMS error or less, rough is 5% or less, otherwise none. "None" adds the closest `cubic-bezier`, fitted together with the timing.
  - **Duration:** the fitted end minus the fitted start, except for springs. A spring's end is undefined (any faster spring over a longer time matches), so springs use the measured duration.
  - The fitted easing is always **Estimated**.
- **Recipe (M5.1)** (`src/core/recipe/`). `buildRecipe({ capture, analysis, styleRows })` is pure and deterministic, and outputs Markdown for an AI coding agent.
  - **Steps:** motions are grouped by trigger and moment. A later step that ends where an earlier one began becomes "plays step N backwards". A stagger is one step.
  - **"How to build it" follows the original mechanism**, so values stay exact:
    - **CSS `:hover` transition:** a CSS-only snippet.
    - **Class change plus CSS transition:** React state toggles the class, and CSS runs it. On scroll-into-view, ScrollTrigger's `toggleClass` adds the class.
    - **Stagger, JavaScript, Web Animations, or unknown:** a `gsap.fromTo` with the captured values. CSS easings become exact `CustomEase` curves (`gsapEaseForCss`). Fitted eases use their GSAP names. A spring becomes `elastic.out` plus Motion's `{ type: 'spring', bounce }`.
    - **Scroll links:** ScrollTrigger `scrub`, from `'top bottom'` to `'bottom top'`, using the observed keyframes when available.
  - The Setup section lists only the plugins and imports the code actually uses, or says no library is needed.
  - Every fact keeps its Observed, Measured, or Estimated label, and the approach is **Recommended**.
  - Every recipe has a "How sure this is" section, says what wasn't captured, and includes reduced-motion advice (plus keyboard advice for hover).
  - **The site's hostname is never included**; a test checks this.
- **Panel results:** `RecordingResults` computes the capture, analysis, and recipe once, then renders `RecipeCard` (Copy recipe and Preview) above `AnalysisCard`. A stagger is shown as one "N × item" block.
- **Panel preview** (`npm run preview:panel -- [screens]`, in `scripts/panel-preview/`):
  - builds the real panel screens (home, design, picking, section, page) with sample data
  - serves them over HTTP, since module scripts don't load from `file://`
  - screenshots them at 380 px, in light and dark mode, into `.output/panel-preview/`
  - uses its own `preview.css`, which points Tailwind at `src/` because the preview is built from another folder

  Use it to look at UI changes when the user can't.
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
  inspector/        runs inside the web page (plain TS): overlay, picker, section input, targets, selection; dormant: snapshot, recorder
  core/             pure logic + tests: sections, selection; dormant: evidence, capture, timeline, analysis/ (M4), recipe/ (M5)
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
- Elements with `pointer-events: none`, which are often decorative layers. They can't be hovered or picked.
- Section mode's choice is a heuristic. It will sometimes pick the wrong container, especially on sites built from nested divs. ↑ and ↓, and Wider and Narrower, are the reliable fix.
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
- Read the page once per action or per highlight update, never continuously. Section detection reads only the hovered element's ancestors and their children.
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
- `npm run sections:check` checks Select Design's choices on `fixtures/sections.html` in headless Chrome, at three widths. It exits with an error if any check fails.
- `npm run golden:record` re-records `fixtures/captures/*.json` in headless Chrome (no window). Pass scenario names to record only some of them, e.g. `npm run golden:record -- toggle reveal`.
- `npm run preview:panel -- home section` screenshots those panel screens with sample data into `.output/panel-preview/`. With no names, it shows all of them.
- Run Vitest from PowerShell or from `D:/ai-interaction`. From Git Bash with the path written as `/d/ai-interaction`, every suite fails with "Cannot read properties of undefined (reading config)". That's a path problem, not broken code.
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
- [x] **M4.2** Easing fit for measured (JavaScript-driven) motion. Golden-tested on 7 known easings.
- [x] **M5.1** Deterministic recipe, copyable, for React + GSAP (plain CSS where enough). Tested on all real captures.
- [ ] **M5.2** (On hold since the redirect) Compare our recipe with a plain "recording + prompt" baseline.

Select Design:

- [ ] **M6.1** Home screen with the two workflows. Element, Section (with ↑/↓ and Wider/Narrower), and Full page selection. Built and tested automatically; waiting for the user's test in Chrome.
- [ ] **M6.2** Design capture: a screenshot of the selection (`tabs.captureVisibleTab`, cropped, visible part only) and design facts (typography, colors, spacing, layout, backgrounds, borders, shadows, images, structure), shown in the panel.
- [ ] **M6.3** Prompt generation adapted to the scope, and the shared prompt screen: Copy prompt, Copy screenshot, React or HTML/CSS, Regenerate.

Record Motion:

- [ ] **M7.1** 5-second tab video (`tabCapture`): countdown, stop early, auto-stop, preview with replay, Record again.
- [ ] **M7.2** Timestamped frames, exact facts from the browser where available, and an honest "AI not set up" state.
- [ ] **M7.3** AI analysis of the video into a prompt, through a backend that holds the key (approach to be decided).

- [ ] **M8** Test on real sites, then performance, accessibility, polish, and Web Store readiness.

## Scope

- **Not in V1:** authentication, payments, a marketplace, community features, full website cloning, deployment, broad framework support, complex cloud infrastructure, and promises of pixel-perfect recreation.
- **Later, by decision only:** main-world library detection, and "Adapt to My Project".
- **Decisions still open:**
  - M6.2: privacy for screenshots, which show whatever is visible
  - M6.3: page text in the prompt (placeholders or short real labels)
  - M7.1: the `tabCapture` permission, which Chrome describes as "Read and change all your data on all websites", requested at first use, versus `getDisplayMedia`'s share picker every time
  - M7.3: how the AI service works

  Early research for M7 (2026-11-02, not yet double-checked; confirm against current Chrome docs and in Chrome before building):
  - Use `tabCapture.getMediaStreamId({ targetTabId })`, then `getUserMedia` with `chromeMediaSource: 'tab'`. After the toolbar click, this needs no picker.
  - The ID can be requested from the side panel but not from content scripts. It's single-use and expires after about 10 seconds.
  - Without `consumerTabId` (Chrome 116+), the side panel itself may be able to record, with no offscreen document. Test that first.
  - Capture video only, so the tab's sound keeps playing for the user.
