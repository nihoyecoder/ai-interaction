import { browser, defineBackground } from '#imports';
import type { BackgroundToPanel } from '@/messaging/protocol';

export default defineBackground(() => {
  // We handle toolbar clicks ourselves instead of using Chrome's automatic
  // "open panel on click" setting. A click on the extension's action is what
  // grants temporary access to the current tab (activeTab), and opening the
  // panel this way keeps an already-open panel open.
  browser.action.onClicked.addListener((tab) => {
    // Call this straight away, while Chrome still counts it as part of the user's click.
    browser.sidePanel
      .open({ windowId: tab.windowId })
      .catch((error: unknown) => console.error('Could not open the side panel', error));

    // If the panel is already open, tell it to re-check this tab: access may have just been granted.
    if (tab.id !== undefined) {
      const message: BackgroundToPanel = { type: 'toolbar-clicked', tabId: tab.id };
      browser.runtime.sendMessage(message).catch(() => {
        // No panel is listening yet. It checks the tab itself when it opens.
      });
    }
  });
});
