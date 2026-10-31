import { browser } from '#imports';
import { StatusBadge } from './components/StatusBadge';
import { useEscapeKey } from './hooks/useEscapeKey';
import { getPanelView } from './panel-view';
import { getBadge, ViewScreen } from './screens/ViewScreen';
import { useActiveTab } from './session/useActiveTab';
import { useInspectorConnection } from './session/useInspectorConnection';

const version = browser.runtime.getManifest().version;

export function App() {
  const activeTab = useActiveTab();
  const { connection, connect, startPicking, cancelPicking, disconnect } = useInspectorConnection();
  const view = getPanelView(activeTab, connection);
  const badge = getBadge(view);
  // After clicking "Select element", keyboard focus is still in the panel, so Esc must work here too.
  useEscapeKey(view.kind === 'picking', cancelPicking);

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-5 rounded-md bg-neutral-900 dark:bg-neutral-100" />
          <h1 className="text-sm font-semibold tracking-tight">AI Interaction</h1>
        </div>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </header>

      <main aria-live="polite" className="flex-1 px-4 py-6">
        <ViewScreen
          view={view}
          onConnect={connect}
          onSelectElement={startPicking}
          onCancelPicking={cancelPicking}
          onDisconnect={disconnect}
          onGoToTab={goToTab}
        />
      </main>

      <footer className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">v{version}</footer>
    </div>
  );
}

function goToTab(tabId: number): void {
  browser.tabs.update(tabId, { active: true }).catch((error: unknown) => console.error('Could not switch tabs', error));
}
