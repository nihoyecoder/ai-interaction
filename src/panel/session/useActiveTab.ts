import { useEffect, useState } from 'react';
import { browser, type Browser } from '#imports';
import type { BackgroundToPanel } from '@/messaging/protocol';

export interface ActiveTab {
  id: number;
  /** Chrome hides the URL until the extension has access to this tab. */
  url: string | undefined;
}

/**
 * Tracks the active tab in the side panel's window. Re-checks it when the user
 * switches tabs, the page changes, or the toolbar button is clicked, because a
 * click can give the extension access to the tab.
 */
export function useActiveTab(): ActiveTab | null {
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);

  useEffect(() => {
    let disposed = false;
    let windowId: number | undefined;

    const refresh = async () => {
      windowId ??= (await browser.windows.getCurrent()).id;
      const [tab] = await browser.tabs.query({ active: true, windowId });
      if (disposed) return;
      setActiveTab(tab?.id === undefined ? null : { id: tab.id, url: tab.url });
    };
    const refreshSafely = () => {
      refresh().catch((error: unknown) => console.error('Could not read the active tab', error));
    };

    const onActivated = (info: { windowId: number }) => {
      if (info.windowId === windowId) refreshSafely();
    };
    const onUpdated = (_tabId: number, _change: unknown, tab: Browser.tabs.Tab) => {
      if (tab.active && tab.windowId === windowId) refreshSafely();
    };
    const onMessage = (message: BackgroundToPanel) => {
      if (message.type === 'toolbar-clicked') refreshSafely();
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.runtime.onMessage.addListener(onMessage);
    refreshSafely();

    return () => {
      disposed = true;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return activeTab;
}
