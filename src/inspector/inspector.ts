import { browser, type Browser } from '#imports';
import {
  INSPECTOR_PORT_NAME,
  type InspectorToPanel,
  type PageInfo,
  type PanelToInspector,
} from '@/messaging/protocol';
import { summarizeElement } from './dom';
import { startPicker } from './picker';

/** Stop waiting if the side panel hasn't connected by then (for example, it was closed). */
const CONNECT_TIMEOUT_MS = 10_000;
/** Page text is untrusted and may be personal, so keep only a short label. */
const MAX_TITLE_LENGTH = 120;
/** Marks that an injected copy is already waiting for the panel to connect. */
const WAITING_FLAG = '__aiInteractionInspectorWaiting';

/**
 * Runs inside the web page, in the extension's isolated world, which shares
 * the page's DOM but not its JavaScript. Waits for the side panel to connect,
 * then serves it until the connection closes. Each connection is its own
 * session, and everything a session adds is removed when it ends.
 */
export function startInspector(): void {
  // This globalThis belongs to the isolated world; the page can't see it.
  const world = globalThis as typeof globalThis & { [WAITING_FLAG]?: boolean };
  if (world[WAITING_FLAG]) return;
  world[WAITING_FLAG] = true;

  const onConnect = (port: Browser.runtime.Port) => {
    if (port.name !== INSPECTOR_PORT_NAME) return;
    stopWaiting();
    runSession(port);
  };
  const timeout = setTimeout(stopWaiting, CONNECT_TIMEOUT_MS);
  browser.runtime.onConnect.addListener(onConnect);

  function stopWaiting() {
    clearTimeout(timeout);
    browser.runtime.onConnect.removeListener(onConnect);
    delete world[WAITING_FLAG];
  }
}

function runSession(port: Browser.runtime.Port): void {
  log('Connected to the side panel.');
  let stopPicker: (() => void) | null = null;

  const onMessage = (message: PanelToInspector) => {
    switch (message.type) {
      case 'page-info:request':
        send(port, { type: 'page-info', page: readPageInfo() });
        break;
      case 'picker:start':
        stopPicker?.();
        stopPicker = startPicker({
          onSelect: (element) => {
            stopPicker = null;
            send(port, { type: 'picker:selected', element: summarizeElement(element) });
          },
          onCancel: () => {
            stopPicker = null;
            send(port, { type: 'picker:cancelled' });
          },
        });
        break;
      case 'picker:cancel':
        stopPicker?.();
        stopPicker = null;
        break;
    }
  };

  port.onMessage.addListener(onMessage);
  // Fires when the panel disconnects or closes. Session cleanup goes here.
  port.onDisconnect.addListener(() => {
    stopPicker?.();
    stopPicker = null;
    port.onMessage.removeListener(onMessage);
    log('Disconnected and cleaned up.');
  });
}

function send(port: Browser.runtime.Port, message: InspectorToPanel): void {
  port.postMessage(message);
}

function readPageInfo(): PageInfo {
  return { title: document.title.slice(0, MAX_TITLE_LENGTH) };
}

/** Logs to the page's DevTools console in development builds only. */
function log(message: string): void {
  if (import.meta.env.DEV) console.info(`[AI Interaction] ${message}`);
}
