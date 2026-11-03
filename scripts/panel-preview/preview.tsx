// Renders one side panel screen with sample data, outside the extension, so its layout can be screenshotted
// and reviewed (see render.mjs). The screen's name is injected as window.__screen.
import { createRoot } from 'react-dom/client';
import { createElementSelection, createPageSelection } from '@/core/selection';
import { StatusBadge } from '@/panel/components/StatusBadge';
import type { PanelView } from '@/panel/panel-view';
import { getBadge, ViewScreen } from '@/panel/screens/ViewScreen';
import './preview.css';

const hostname = 'northwind.example';
const viewport = { width: 1024, height: 900 };

const section = createElementSelection({
  scope: 'section',
  tag: 'section',
  id: '',
  classes: ['hero'],
  rect: { left: 0, top: 104, width: 1024, height: 612 },
  scroll: { x: 0, y: 0 },
  path: ['html', 'body', 'div', 'div', 'main'].map((tag, index) => ({
    tag,
    id: index === 2 ? 'root' : '',
    classes: index === 3 ? ['app'] : [],
  })),
  canWiden: true,
  canNarrow: true,
  viewport,
});

const sections: Array<[string, string[], number, 'flow' | 'sticky' | 'fixed']> = [
  ['div', ['announcement'], 41, 'flow'],
  ['header', ['site-header'], 65, 'sticky'],
  ['section', ['hero'], 612, 'flow'],
  ['section', ['logos'], 105, 'flow'],
  ['section', ['features'], 709, 'flow'],
  ['div', ['block-pricing'], 726, 'flow'],
  ['section', ['faq'], 742, 'flow'],
  ['section', ['cta'], 262, 'flow'],
  ['footer', ['site-footer'], 380, 'flow'],
];
const page = createPageSelection({
  page: { width: 1024, height: 3642 },
  viewport,
  sections: sections.map(([tag, classes, height, placement]) => ({ tag, id: '', classes, width: 1024, height, placement })),
});

const SCREENS: Record<string, PanelView> = {
  home: { kind: 'home', tabId: 1, hostname, notice: null },
  design: { kind: 'design', hostname, connecting: false },
  picking: { kind: 'picking', hostname, mode: 'section' },
  section: { kind: 'selected', hostname, selection: section },
  page: { kind: 'selected', hostname, selection: page },
};

const view = SCREENS[(window as unknown as { __screen: string }).__screen];
if (!view) throw new Error('Unknown screen');
const badge = getBadge(view);
const noop = () => undefined;

// The same shell as src/panel/App.tsx, which can't run outside the extension.
createRoot(document.getElementById('root')!).render(
  <div className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-5 rounded-md bg-neutral-900 dark:bg-neutral-100" />
        <h1 className="text-sm font-semibold tracking-tight">AI Interaction</h1>
      </div>
      <StatusBadge label={badge.label} tone={badge.tone} />
    </header>
    <main className="flex-1 px-4 py-6">
      <ViewScreen
        view={view}
        onSelectDesign={noop}
        onPick={noop}
        onSelectPage={noop}
        onCancelPicking={noop}
        onWider={noop}
        onNarrower={noop}
        onClearSelection={noop}
        onEndSession={noop}
        onGoToTab={noop}
      />
    </main>
    <footer className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">v0.1.0</footer>
  </div>,
);
