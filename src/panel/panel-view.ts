import type { ElementSummary } from '@/core/element-summary';
import { getPageSupport, type RestrictedReason } from '@/core/page-support';
import type { PageInfo } from '@/messaging/protocol';
import type { ActiveTab } from './session/useActiveTab';
import type { Connection } from './session/useInspectorConnection';

export type Notice =
  | { kind: 'connection-closed' }
  | { kind: 'connection-failed'; message: string; detail: string };

/** Everything the side panel can show. Pure data, so it's easy to test. */
export type PanelView =
  | { kind: 'loading' }
  | { kind: 'no-access'; notice: Notice | null }
  | { kind: 'restricted'; reason: RestrictedReason }
  | { kind: 'ready'; tabId: number; hostname: string; notice: Notice | null }
  | { kind: 'connecting'; hostname: string }
  | { kind: 'connected'; hostname: string; page: PageInfo }
  | { kind: 'picking'; hostname: string }
  | { kind: 'selected'; hostname: string; element: ElementSummary }
  | { kind: 'away'; tabId: number; hostname: string };

/**
 * Decides what the panel shows. A session belongs to the tab where it started:
 * on any other tab, the panel asks the user to return or disconnect.
 */
export function getPanelView(activeTab: ActiveTab | null, connection: Connection): PanelView {
  if (connection.status === 'connecting' || connection.status === 'connected') {
    if (activeTab?.id !== connection.tabId) {
      return { kind: 'away', tabId: connection.tabId, hostname: connection.hostname };
    }
    const { hostname } = connection;
    if (connection.status === 'connecting') return { kind: 'connecting', hostname };
    if (connection.picking) return { kind: 'picking', hostname };
    if (connection.selected) return { kind: 'selected', hostname, element: connection.selected };
    return { kind: 'connected', hostname, page: connection.page };
  }

  if (!activeTab) return { kind: 'loading' };

  const notice = noticeFor(activeTab.id, connection);
  const support = getPageSupport(activeTab.url);
  switch (support.kind) {
    case 'no-access':
      return { kind: 'no-access', notice };
    case 'restricted':
      return { kind: 'restricted', reason: support.reason };
    case 'supported':
      return { kind: 'ready', tabId: activeTab.id, hostname: support.hostname, notice };
  }
}

/** Notices about an ended or failed session appear only on that session's tab. */
function noticeFor(tabId: number, connection: Connection): Notice | null {
  if (connection.status === 'closed' && connection.tabId === tabId) return { kind: 'connection-closed' };
  if (connection.status === 'failed' && connection.tabId === tabId) {
    return { kind: 'connection-failed', message: connection.message, detail: connection.detail };
  }
  return null;
}
