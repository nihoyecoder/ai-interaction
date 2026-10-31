import type { RestrictedReason } from '@/core/page-support';
import { Button } from '../components/Button';
import { NoticeBanner } from '../components/NoticeBanner';
import { Screen } from '../components/Screen';
import type { BadgeTone } from '../components/StatusBadge';
import type { PanelView } from '../panel-view';

const RESTRICTED_COPY: Record<RestrictedReason, string> = {
  'browser-page': "Chrome doesn't let extensions work on its own pages, like the New Tab page or Settings. Open a website to continue.",
  'web-store': "Chrome doesn't let extensions work on the Chrome Web Store. Open another website to continue.",
  'local-file': "Local files aren't supported yet. Open the page through a local server, such as http://localhost, instead.",
  'not-a-website': 'AI Interaction works on regular websites, meaning pages whose address starts with http or https.',
};

const CONNECT_COPY =
  'AI Interaction reads this page only after you connect. It stops when you disconnect or close this panel.';

interface ViewScreenProps {
  view: PanelView;
  onConnect: (tabId: number, hostname: string) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onGoToTab: (tabId: number) => void;
}

export function ViewScreen({ view, onConnect, onRefresh, onDisconnect, onGoToTab }: ViewScreenProps) {
  switch (view.kind) {
    case 'loading':
      return <Screen title="Checking this page…" />;

    case 'no-access':
      return (
        <Screen title="Give access to this page" notice={view.notice && <NoticeBanner notice={view.notice} />}>
          With this page open, click the AI Interaction icon in Chrome's toolbar or in the puzzle-piece menu. Access
          lasts until you leave this site.
        </Screen>
      );

    case 'restricted':
      return <Screen title="This page can't be inspected">{RESTRICTED_COPY[view.reason]}</Screen>;

    case 'ready':
      return (
        <Screen
          eyebrow={view.hostname}
          title="Connect to this page"
          notice={view.notice && <NoticeBanner notice={view.notice} />}
          actions={<Button onClick={() => onConnect(view.tabId, view.hostname)}>Connect</Button>}
        >
          {CONNECT_COPY}
        </Screen>
      );

    case 'connecting':
      return (
        <Screen eyebrow={view.hostname} title="Connect to this page" actions={<Button disabled>Connecting…</Button>}>
          {CONNECT_COPY}
        </Screen>
      );

    case 'connected':
      return (
        <Screen
          eyebrow={view.hostname}
          title="Connected"
          actions={
            <>
              <Button variant="secondary" onClick={onRefresh}>
                Refresh
              </Button>
              <Button variant="secondary" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          }
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt>Page title</dt>
            <dd className="truncate text-neutral-900 dark:text-neutral-100">{view.page.title || 'Untitled'}</dd>
            <dt>Elements</dt>
            <dd className="text-neutral-900 tabular-nums dark:text-neutral-100">
              {view.page.elementCount.toLocaleString()}
            </dd>
          </dl>
        </Screen>
      );

    case 'away':
      return (
        <Screen
          eyebrow={view.hostname}
          title="Your session is in another tab"
          actions={
            <>
              <Button onClick={() => onGoToTab(view.tabId)}>Return to {view.hostname}</Button>
              <Button variant="secondary" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          }
        >
          The connection stays with the tab where it started. Go back to continue, or disconnect to start on this
          tab.
        </Screen>
      );
  }
}

export function getBadge(view: PanelView): { label: string; tone: BadgeTone } {
  switch (view.kind) {
    case 'loading':
      return { label: 'Checking', tone: 'neutral' };
    case 'no-access':
      return { label: 'No access', tone: 'warning' };
    case 'restricted':
      return { label: 'Unavailable', tone: 'neutral' };
    case 'ready':
      return { label: 'Ready', tone: 'neutral' };
    case 'connecting':
      return { label: 'Connecting', tone: 'neutral' };
    case 'connected':
      return { label: 'Connected', tone: 'positive' };
    case 'away':
      return { label: 'Other tab', tone: 'warning' };
  }
}
